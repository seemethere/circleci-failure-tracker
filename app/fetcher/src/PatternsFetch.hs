{-# LANGUAGE OverloadedStrings #-}

module PatternsFetch where

import           Control.Monad.IO.Class     (liftIO)
import           Control.Monad.Trans.Except (ExceptT (ExceptT), except,
                                             runExceptT)
import           Data.Aeson                 (eitherDecode)
import           Data.Bifunctor             (first)
import qualified Data.Text                  as T
import           GHC.Int                    (Int64)
import qualified Network.HTTP.Client        as NC
import           Network.Wreq               as NW

import qualified FetchHelpers
import qualified SqlRead
import qualified SqlWrite


-- | For seeding initial data
populatePatterns :: SqlRead.DbIO (Either String [Int64])
populatePatterns = runExceptT $ do

  response <- ExceptT $ liftIO $ FetchHelpers.safeGetUrl $ NW.get url_string
  decoded_json <- except $ eitherDecode $ NC.responseBody response
  ExceptT $ restore_patterns decoded_json

  where
    url_string = "https://raw.githubusercontent.com/kostmo/circleci-failure-tracker/master/data/patterns-dump.json"

    restore_patterns = fmap (first T.unpack) . SqlWrite.restorePatterns
