{-# LANGUAGE DeriveAnyClass #-}
{-# LANGUAGE DeriveGeneric  #-}

module CommitBuilds where

import           Data.Aeson
import qualified Data.Text.Lazy                     as LT
import           Database.PostgreSQL.Simple         (FromRow)
import           Database.PostgreSQL.Simple.FromRow (field, fromRow)
import           GHC.Generics

import qualified Builds
import qualified DbHelpers
import qualified JsonUtils
import qualified MatchOccurrences
import qualified ScanPatterns


data FailureModeInfo = FailureModeInfo {
    _is_timeout :: Bool
  } deriving (Generic, FromRow)

instance ToJSON FailureModeInfo where
  toJSON = genericToJSON JsonUtils.dropUnderscore



data LogContext = LogContext {
    _match_info :: ScanPatterns.MatchDetails
  , _log_lines  :: [(Int, LT.Text)]
  } deriving Generic

instance ToJSON LogContext where
  toJSON = genericToJSON JsonUtils.dropUnderscore


data BuildWithLogContext = BuildWithLogContext {
    commit_build :: CommitBuild
  , log_context  :: LogContext
  }


data CommitBuild = NewCommitBuild {
    _build        :: Builds.StorableBuild
  , _match        :: MatchOccurrences.MatchOccurrencesForBuild
  , _provider     :: DbHelpers.WithId Builds.CiProvider
  , _failure_mode :: FailureModeInfo
  } deriving Generic

instance ToJSON CommitBuild where
  toJSON = genericToJSON JsonUtils.dropUnderscore


instance FromRow CommitBuild where
  fromRow = do
    step_name <- field
    match_id <- field
    buildnum <- field
    vcs_rev <- field
    queuedat <- field
    jobname <- field
    branch <- field
    patt <- field
    line_number <- field
    line_count <- field
    line_text <- field
    span_start <- field
    span_end <- field
    specificity <- field
    universal_build <- field
    provider_id <- field
    build_namespace <- field
    succeeded <- field
    ci_label <- field
    ci_icon_url <- field
    started_at <- field
    finished_at <- field
    is_timeout <- field

    let provider_obj = Builds.CiProvider
          ci_icon_url
          ci_label

        universal_build_obj = Builds.UniversalBuild
          wrapped_build_num
          provider_id
          build_namespace
          succeeded
          wrapped_commit

        parent_build_obj = Builds.StorableBuild
          (DbHelpers.WithId universal_build universal_build_obj)
          build_obj

        wrapped_commit = Builds.RawCommit vcs_rev
        wrapped_build_num = Builds.NewBuildNumber buildnum

        build_obj = Builds.NewBuild
          wrapped_build_num
          wrapped_commit
          queuedat
          jobname
          branch
          started_at
          finished_at

        match_obj = MatchOccurrences.MatchOccurrencesForBuild
          step_name
          (ScanPatterns.PatternId patt)
          (MatchOccurrences.MatchId match_id)
          line_number
          line_count
          line_text
          span_start
          span_end
          specificity

        provider_with_id = DbHelpers.WithId provider_id provider_obj

        failure_mode_info = FailureModeInfo is_timeout

    return $ NewCommitBuild
      parent_build_obj
      match_obj
      provider_with_id
      failure_mode_info
