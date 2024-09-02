#!/usr/bin/env bash

set -euoi pipefail

npm version --allow-same-version --git-tag-version false "0.0.0-experimental-$(git rev-parse --short HEAD)-$(date +%Y%m%d)"

npm publish --tag experimental
