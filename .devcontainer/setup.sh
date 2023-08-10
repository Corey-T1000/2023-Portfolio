#!/bin/bash

set -eou pipefail

sudo apt-get update
sudo apt install -y bash-completion

pnpm install
