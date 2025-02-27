#!/bin/bash

function _export() {
    if [ -z "$1" ]; then
        echo "Missing argument"
        exit 1
    fi
    if [ -n "$GITHUB_ENV" ]; then
        echo "$1" >>"$GITHUB_ENV"
    fi
    # shellcheck disable=SC2163
    export "$1"
}

function checkTag() {
    GIT_TAG="$1"
    if [ -z "$GIT_TAG" ]; then
        echo "Missing GIT_TAG script argument"
        exit 2
    fi
    _export GIT_ROOT_PATH="$(git rev-parse --show-toplevel)"
    if ! [ -f "${GIT_ROOT_PATH}/package.json" ]; then
        echo "File is not defined under ${GIT_ROOT_PATH}/package.json"
        exit 2
    fi
    _export EXTENSION_NAME="$(jq -r '.name // empty' "${GIT_ROOT_PATH}/package.json")"
    if [ -z "$EXTENSION_NAME" ]; then
        echo "Cannot parse vscode extension name from file ${GIT_ROOT_PATH}/package.json"
        exit 2
    fi
    _export EXTENSION_PUBLISHER="$(jq -r '.publisher // empty' "${GIT_ROOT_PATH}/package.json")"
    if [ -z "$EXTENSION_PUBLISHER" ]; then
        echo "Cannot parse vscode extension publisher from file ${GIT_ROOT_PATH}/package.json"
        exit 2
    fi
    _export EXTENSION_FQDN="${EXTENSION_PUBLISHER}.${EXTENSION_NAME}"
    _export EXTENSION_VERSION="${GIT_TAG/v/}"
    if [ -z "$EXTENSION_VERSION" ]; then
        echo "Cannot parse version from tag $GIT_TAG"
        exit 2
    fi
    if vsce show "$EXTENSION_FQDN" --json | jq -r '.versions[].version // empty' | grep -q -P "^${EXTENSION_VERSION}$"; then
        echo "Version $EXTENSION_VERSION is already published to vscode marketplace $EXTENSION_FQDN"
        exit 2
    fi
    echo "Tag $GIT_TAG sanity check is successful"
}

function setVersion() {
    PACKAGE_DATA=$(jq . "${GIT_ROOT_PATH}/package.json")
    if [ -z "$PACKAGE_DATA" ]; then
        echo "Cannot parse json data from template file ${GIT_ROOT_PATH}/package.json"
        exit 3
    fi
    PACKAGE_VERSION=$(jq -r '.version // empty' <<<"$PACKAGE_DATA")
    if [ -z "$PACKAGE_VERSION" ]; then
        echo "Cannot parse version to replace from template file ${GIT_ROOT_PATH}/package.json"
        exit 3
    fi
    jq -r '.version = "'"$EXTENSION_VERSION"'"' <<<"$PACKAGE_DATA" >"${GIT_ROOT_PATH}/package.json"
    echo "Version $EXTENSION_VERSION updated successfully to file ${GIT_ROOT_PATH}/package.json"
    jq . "${GIT_ROOT_PATH}/package.json" || cat "${GIT_ROOT_PATH}/package.json"
}

function build() {
    (cd "${GIT_ROOT_PATH}" && vsce package)
    _export PACKAGE_PATH="${GIT_ROOT_PATH}/${EXTENSION_NAME}-${EXTENSION_VERSION}.vsix"
    if ! [ -f "$PACKAGE_PATH" ]; then
        echo "Missing package $PACKAGE_PATH despite build finished successfully"
        exit 4
    fi
    PACKAGE_CHECKSUM=$(sha256sum "$PACKAGE_PATH" | awk '{print $1}')
    echo "Package built successfully to $PACKAGE_PATH with sha256sum $PACKAGE_CHECKSUM"
}

function publish() {
    if [ -z "$VSCE_PAT" ]; then
        echo "Missing PAT for vsce. Please declare a GitHub secret named VSCE_PAT"
        exit 5
    fi
    (cd "${GIT_ROOT_PATH}" && vsce publish --pat "$VSCE_PAT")
}

function checkPublication() {
    TTL=5
    INTERVAL=90
    while [ $TTL -gt 0 ]; do
        if vsce show "$EXTENSION_FQDN" --json | jq -r '.versions[].version // empty' | grep -q -P "^${EXTENSION_VERSION}$"; then
            echo "Package version $EXTENSION_VERSION published successfully to $EXTENSION_FQDN"
            exit 0
        fi
        echo "Waiting ${INTERVAL}s for API to check package $EXTENSION_FQDN version $EXTENSION_VERSION publication ($TTL attempt(s) left)..."
        sleep $INTERVAL
        TTL=$((TTL - 1))
    done
    echo "An error has occured while publishing package ${EXTENSION_FQDN}: version $EXTENSION_VERSION not found after $TTL attempts with an interval of ${INTERVAL}s"
    exit 6
}
