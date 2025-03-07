{-# LANGUAGE OverloadedStrings #-}

module DbPreparation where

import           Control.Monad              (when)
import           Control.Monad.Trans.Reader (runReaderT)
import           Data.Foldable              (for_)
import           Database.PostgreSQL.Simple

import qualified Constants
import qualified DbHelpers
import qualified PatternsFetch
import qualified SqlWrite


buildDataTruncations :: [Query]
buildDataTruncations = [
    "TRUNCATE log_metadata CASCADE;"
  , "TRUNCATE build_steps CASCADE;"
  , "TRUNCATE created_github_statuses CASCADE;"
  , "TRUNCATE builds CASCADE;"
  , "TRUNCATE ordered_master_commits CASCADE;"
  ]


scanTruncations :: [Query]
scanTruncations = [
    "TRUNCATE scanned_patterns CASCADE;"
  , "TRUNCATE scans CASCADE;"
  , "TRUNCATE matches CASCADE;"
  , "TRUNCATE pattern_step_applicability CASCADE;"
  , "TRUNCATE pattern_tags CASCADE;"
  , "TRUNCATE pattern_authorship CASCADE;"
  , "TRUNCATE patterns CASCADE;"
  , "TRUNCATE presumed_stable_branches CASCADE;"
  ]


-- | We do not wipe the "builds" or "build_steps" tables
-- because visiting each build is expensive.
allTableTruncations :: [Query]
allTableTruncations = scanTruncations ++ buildDataTruncations


-- | Not currently used
wipeAndRepopulateDb :: Connection -> IO ()
wipeAndRepopulateDb conn = do
  scrubTables conn
  runReaderT PatternsFetch.populatePatterns conn
  SqlWrite.populatePresumedStableBranches conn Constants.presumedGoodBranches
  return ()


prepareDatabase ::
  DbHelpers.DbConnectionData
  -> Bool -> IO Connection
prepareDatabase conn_data wipe = do

  conn <- DbHelpers.get_connection conn_data

  when wipe $
    putStrLn "Wiping not supported."

  return conn


scrubTables :: Connection -> IO ()
scrubTables conn =

  for_ table_truncation_commands $ \table_truncation_command ->
    execute_ conn table_truncation_command

  where
--    table_truncation_commands = allTableTruncations
    table_truncation_commands = scanTruncations
