# exit on error
set -o errexit

npm install

# Force Puppeteer to install the browser into a local folder that Render will include in the build artifact
export PUPPETEER_CACHE_DIR=$HOME/project/src/Backend/.cache/puppeteer
npx puppeteer browsers install chrome
