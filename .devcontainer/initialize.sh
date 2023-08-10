#!/bin/bash

# This looks for any files ending in .tmpl in the .devcontainer directory
# and makes a copy of them as the file name without the .tmpl extension,
# but does not overwrite any existing files.
for template_file_path in $(find .devcontainer/ -name '*.tmpl' -type f)
do
  real_file_path="${template_file_path%%.tmpl}"

  if [ ! -f "${real_file_path}" ]; then
    echo "Copying ${template_file_path} to ${real_file_path}"
    cp "${template_file_path}" "${real_file_path}"
  else
    echo "${real_file_path} already exists, not overwriting."
  fi
done
