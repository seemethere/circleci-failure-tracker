{-# LANGUAGE DeriveAnyClass    #-}
{-# LANGUAGE DeriveGeneric     #-}
{-# LANGUAGE OverloadedStrings #-}

module Builds where

import           Data.Aeson
import           Data.Text                            (Text)
import           Data.Time                            (UTCTime)
import           Database.PostgreSQL.Simple           (FromRow)
import           Database.PostgreSQL.Simple.FromField (FromField, fromField)
import           GHC.Generics
import           GHC.Int                              (Int64)

import qualified DbHelpers

masterName :: Text
masterName = "master"


newtype RawCommit = RawCommit Text
 deriving (Generic, Show)

instance ToJSON RawCommit
instance FromJSON RawCommit

newtype BuildNumber = NewBuildNumber Int64
  deriving (Show, Generic, Eq, Ord, FromRow)

instance ToJSON BuildNumber
instance FromJSON BuildNumber


newtype UniversalBuildId = UniversalBuildId Int64
  deriving (Show, Generic, Eq, Ord)



-- TODO do error handling: http://hackage.haskell.org/package/postgresql-simple-0.6.2/docs/Database-PostgreSQL-Simple-FromField.html
instance FromField BuildNumber where
  fromField f mdata = NewBuildNumber <$> fromField f mdata


newtype BuildStepId = NewBuildStepId Int64
  deriving (Show, Generic)

instance ToJSON BuildStepId
instance FromJSON BuildStepId


data UniversalBuild = UniversalBuild {
    provider_buildnum :: BuildNumber
  , provider_id       :: Int64
  , build_namespace   :: Text
  , succeeded         :: Bool
  , sha1              :: RawCommit
  } deriving (Show, Generic)


data StorableBuild = StorableBuild {
    univeral_build :: DbHelpers.WithId UniversalBuild -- ^ this already came from database
  , build_record   :: Build
  }


data Build = NewBuild {
    build_id     :: BuildNumber -- ^ deprecated; should come from UniversalBuild
  , vcs_revision :: RawCommit
  , queued_at    :: UTCTime
  , job_name     :: Text
  , branch       :: Text
  } deriving (Show, Generic)

instance ToJSON Build
instance FromJSON Build


data BuildWithStepFailure = BuildWithStepFailure {
    build_object        :: Build
  , step_failure_object :: BuildStepFailure
  } deriving Show


data BuildStepFailure = NewBuildStepFailure {
    step_name    :: Text
  , failure_mode :: BuildFailureMode
  } deriving Show


-- | There can be different modes in which the build fails.
data BuildFailureMode =
    BuildTimeoutFailure
  | ScannableFailure BuildFailureOutput
  deriving Show


newtype BuildFailureOutput = NewBuildFailureOutput {
    log_url :: Text
  } deriving Show
