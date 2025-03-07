{-# LANGUAGE DeriveGeneric         #-}
{-# LANGUAGE DuplicateRecordFields #-}

module Breakages where

import           Data.Aeson
import           Data.Text    (Text)
import           GHC.Generics
import           GHC.Int      (Int64)

import qualified AuthStages
import qualified Builds


data BreakageReport = NewBreakageReport {
    sha1        :: Builds.RawCommit
  , description :: Text
  , reporter    :: AuthStages.Username
  } deriving Generic

instance ToJSON BreakageReport
instance FromJSON BreakageReport


data ResolutionReport = NewResolutionReport {
    sha1     :: Text
  , cause    :: Int64
  , reporter :: AuthStages.Username
  } deriving Generic

instance ToJSON ResolutionReport
instance FromJSON ResolutionReport


