{-# LANGUAGE DeriveGeneric         #-}
{-# LANGUAGE DuplicateRecordFields #-}
{-# LANGUAGE OverloadedStrings     #-}

module SqlUpdate where

import           Control.Monad.IO.Class     (liftIO)
import           Control.Monad.Trans.Except (ExceptT (ExceptT), except,
                                             runExceptT)
import           Control.Monad.Trans.Reader (ask, runReaderT)
import           Data.Aeson
import           Data.Either.Utils          (maybeToEither)
import           Data.Set                   (Set)
import qualified Data.Set                   as Set
import           Data.Text                  (Text)
import qualified Data.Text                  as T
import           Database.PostgreSQL.Simple
import           GHC.Generics
import qualified Network.OAuth.OAuth2       as OAuth2
import qualified Safe

import qualified Builds
import qualified BuildSteps
import qualified Constants
import qualified DbHelpers
import qualified DebugUtils                 as D
import qualified GitRev
import qualified JsonUtils
import qualified MyUtils
import qualified QueryUtils                 as Q
import qualified SqlRead
import qualified SqlWrite


pytorchRepoOwner :: DbHelpers.OwnerAndRepo
pytorchRepoOwner = DbHelpers.OwnerAndRepo Constants.projectName Constants.repoName


data CommitInfoCounts = NewCommitInfoCounts {
    _failed_build_count        :: Int
  , _timeout_count             :: Int
  , _total_matched_build_count :: Int
  , _flaky_build_count         :: Int
  , _other_matched_build_count :: Int
  , _idiopathic_count          :: Int
  , _unmatched_count           :: Int
  , _known_broken_count        :: Int
  } deriving Generic

instance ToJSON CommitInfoCounts where
  toJSON = genericToJSON JsonUtils.dropUnderscore


data CommitInfo = NewCommitInfo {
    _breakages :: [DbHelpers.WithId SqlRead.CodeBreakage]
  , _counts    :: CommitInfoCounts
  } deriving Generic

instance ToJSON CommitInfo where
  toJSON = genericToJSON JsonUtils.dropUnderscore


data SingleBuildInfo = SingleBuildInfo {
    _multi_match_count :: Int
  , _build_info        :: BuildSteps.BuildStep
  , _known_failures    :: [DbHelpers.WithId SqlRead.CodeBreakage]
  , _umbrella_build    :: Builds.StorableBuild
  } deriving Generic

instance ToJSON SingleBuildInfo where
  toJSON = genericToJSON JsonUtils.dropUnderscore


data BuildInfoRetrievalBenchmarks = BuildInfoRetrievalBenchmarks {
    _best_match_retrieval       :: Float
  , _breakages_retrieval_timing :: Float
  } deriving Generic

instance ToJSON BuildInfoRetrievalBenchmarks where
  toJSON = genericToJSON JsonUtils.dropUnderscore


data UpstreamBreakagesInfo = UpstreamBreakagesInfo {
    merge_base :: Builds.RawCommit
  , manually_annotated_breakages :: [DbHelpers.WithId SqlRead.CodeBreakage]
  , inferred_upstream_caused_broken_jobs :: Set Text
  }


getBuildInfo ::
     OAuth2.AccessToken
  -> Builds.UniversalBuildId
  -> SqlRead.DbIO (Either Text (DbHelpers.BenchmarkedResponse BuildInfoRetrievalBenchmarks SingleBuildInfo))
getBuildInfo access_token build@(Builds.UniversalBuildId build_id) = do

  -- TODO Replace this with SQL COUNT()
  DbHelpers.BenchmarkedResponse best_match_retrieval_timing matches <- SqlRead.getBuildPatternMatches build

  either_storable_build <- SqlRead.getGlobalBuild build

  conn <- ask
  liftIO $ do

    xs <- query conn sql $ Only build_id

    let err_msg = unwords [
            "Build with ID"
          , show build_id
          , "not found!"
          ]

        either_tuple = f (length matches) <$> maybeToEither
          (T.pack err_msg)
          (Safe.headMay xs)

    runExceptT $ do

      storable_build <- except either_storable_build
      (multi_match_count, step_container) <- except either_tuple

      let sha1 = Builds.vcs_revision $ BuildSteps.build step_container
          job_name = Builds.job_name $ BuildSteps.build step_container

      -- TODO Replace this!
      (breakages_retrieval_timing, UpstreamBreakagesInfo _ breakages _) <- D.timeThisFloat $ ExceptT $
        findKnownBuildBreakages conn access_token pytorchRepoOwner sha1

      let applicable_breakages = filter (Set.member job_name . SqlRead._jobs . DbHelpers.record) breakages

          timing_info = BuildInfoRetrievalBenchmarks
            best_match_retrieval_timing
            breakages_retrieval_timing

      return $ DbHelpers.BenchmarkedResponse timing_info $ SingleBuildInfo
        multi_match_count
        step_container
        applicable_breakages
        storable_build

  where
    f multi_match_count (
        step_id
      , step_name
      , build_num
      , vcs_revision
      , queued_at
      , job_name
      , branch
      , started_at
      , finished_at
      ) = (multi_match_count, step_container)
      where
        step_container = BuildSteps.NewBuildStep
          step_name
          (Builds.NewBuildStepId step_id)
          build_obj

        -- TODO This is redundant with getGlobalBuild
        build_obj = Builds.NewBuild
          (Builds.NewBuildNumber build_num)
          (Builds.RawCommit vcs_revision)
          queued_at
          job_name
          branch
          started_at
          finished_at

    sql = Q.qjoin [
        "SELECT"
      , Q.list [
          "step_id"
        , "COALESCE(step_name, '') AS step_name"
        , "build_num"
        , "vcs_revision"
        , "queued_at"
        , "job_name"
        , "branch"
        , "started_at"
        , "finished_at"
        ]
      , "FROM builds_join_steps"
      , "WHERE universal_build = ?;"
      ]


data RevisionBuildCountBenchmarks = RevisionBuildCountBenchmarks {
    _row_retrieval              :: Float
  , _known_broken_determination :: Float
  } deriving Generic

instance ToJSON RevisionBuildCountBenchmarks where
  toJSON = genericToJSON JsonUtils.dropUnderscore


countRevisionBuilds ::
     OAuth2.AccessToken
  -> GitRev.GitSha1
  -> SqlRead.DbIO (Either Text (DbHelpers.BenchmarkedResponse RevisionBuildCountBenchmarks CommitInfo))
countRevisionBuilds access_token git_revision = do
  conn <- ask

  liftIO $ D.debugList [
      "SQL query for countRevisionBuilds:"
    , show aggregate_causes_sql
    , "PARMS:"
    , show only_commit
    ]
  (row_retrieval_time, rows) <- D.timeThisFloat $ liftIO $ query conn aggregate_causes_sql only_commit

  liftIO $ runExceptT $ do

    let err = T.pack $ unwords [
            "No entries in"
          , MyUtils.quote "build_failure_disjoint_causes_by_commit"
          , "table for commit"
          , T.unpack $ GitRev.sha1 git_revision
          ]

    (   total
      , idiopathic
      , timeout
      , known_broken
      , pattern_matched
      , pattern_matched_other
      , flaky
      , pattern_unmatched
      , succeeded
      ) <- except $ maybeToEither err $ Safe.headMay rows

    -- TODO Replace this
    (known_broken_determination_time, UpstreamBreakagesInfo _ breakages _) <- D.timeThisFloat $ ExceptT $
      findKnownBuildBreakages conn access_token pytorchRepoOwner $ Builds.RawCommit sha1

    return $ DbHelpers.BenchmarkedResponse
      (RevisionBuildCountBenchmarks row_retrieval_time known_broken_determination_time) $
        NewCommitInfo breakages $ NewCommitInfoCounts
          (total - succeeded)
          timeout
          pattern_matched
          flaky
          pattern_matched_other
          idiopathic
          pattern_unmatched
          known_broken

  where
    sha1 = GitRev.sha1 git_revision
    only_commit = Only sha1

    aggregate_causes_sql = Q.qjoin [
        "SELECT"
      , Q.list [
          "total"
        , "idiopathic"
        , "timeout"
        , "known_broken"
        , "pattern_matched"
        , "pattern_matched_other"
        , "flaky"
        , "pattern_unmatched"
        , "succeeded"
        ]
      , "FROM build_failure_disjoint_causes_by_commit"
      , "WHERE sha1 = ? LIMIT 1;"
      ]


-- TODO This is not finished!
diagnoseCommitsBatch ::
     Connection
  -> OAuth2.AccessToken
  -> DbHelpers.OwnerAndRepo
  -> IO (Either Text ())
diagnoseCommitsBatch conn access_token owned_repo =

  runExceptT $ do

    -- First, ensure knowledge of "master" branch lineage
    -- is up-to-date
    ExceptT $ SqlWrite.populateLatestMasterCommits conn access_token owned_repo

    non_master_uncached_failed_commits <- liftIO $ query_ conn commit_list_sql


    all_master_commits <- liftIO $ SqlRead.getAllMasterCommits conn

    -- NOTE: Some subset of these may be accessible from
    -- the local repo. We can make a first path with the
    -- local repo and then obtain the rest via the GitHub API.
    liftIO $ SqlWrite.cacheAllMergeBases
      conn
      all_master_commits
      access_token
      owned_repo
      non_master_uncached_failed_commits


--    mapM_ (ExceptT . findKnownBuildBreakages conn access_token owned_repo) sha1_list

  where
    -- Excludes commits from the master branch and commits that are already cached
    commit_list_sql = Q.qjoin [
        "SELECT DISTINCT vcs_revision"
      , "FROM builds_join_steps"
      , "LEFT JOIN ordered_master_commits"
      , "ON ordered_master_commits.sha1 = builds_join_steps.vcs_revision"
      , "LEFT JOIN cached_master_merge_base"
      , "ON cached_master_merge_base.branch_commit = builds_join_steps.vcs_revision"
      , "WHERE ordered_master_commits.sha1 IS NULL"
      , "AND cached_master_merge_base.branch_commit IS NULL"
      , "AND NOT succeeded"
      , "AND NOT is_timeout;"
      ]


-- | Find known build breakages applicable to the merge base
-- of this PR commit
findKnownBuildBreakages ::
     Connection
  -> OAuth2.AccessToken
  -> DbHelpers.OwnerAndRepo
  -> Builds.RawCommit
  -> IO (Either Text UpstreamBreakagesInfo)
findKnownBuildBreakages conn access_token owned_repo sha1 =

  runExceptT $ do

    -- Second, find which "master" commit is the most recent
    -- ancestor of the given PR commit.
    nearest_ancestor <- ExceptT $ SqlWrite.findMasterAncestor
      conn
      access_token
      owned_repo
      SqlWrite.StoreToCache
      sha1

    -- Third, find whether that commit is within the
    -- [start, end) span of any known breakages
    manually_annotated_breakages <- ExceptT $ SqlRead.getSpanningBreakages conn nearest_ancestor

    -- TODO Use both manually annotated and inferred methods for
    -- associating breakages!

    inferred_upstream_caused_broken_jobs <- liftIO $ runReaderT
      (SqlRead.getInferredSpanningBrokenJobsBetter sha1)
      conn

    -- NOTE: This requires that the "merge base" with master of the branch
    -- commit already be cached into the database.
    -- SqlWrite.findMasterAncestor does this for us.
    return $ UpstreamBreakagesInfo
      nearest_ancestor
      manually_annotated_breakages $
        Set.fromList $
          map SqlRead.extractJobName inferred_upstream_caused_broken_jobs
