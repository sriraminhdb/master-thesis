#!/usr/bin/env bash
set -e
# Run from packages/backend
firebase emulators:start --only functions,firestore