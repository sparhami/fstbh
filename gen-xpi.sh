#!/bin/sh

buildDir=".build"
buildTarget="fstbh"
buildExtension="xpi"

# version is the branch/tag we are building from
version=$(git describe --tags)
artifactName=${buildTarget}-${version}.${buildExtension}

rm -rf ${buildDir}/${buildTarget}-*.${buildExtension}
mkdir -p ${buildDir}
zip -x install.rdf gen-xpi.sh -r ${buildDir}/${artifactName} *

sed "s;\$VERSION;${version};g" install.rdf > ${buildDir}/install.rdf
pushd ${buildDir}
  zip ${artifactName} install.rdf
popd
