#!/usr/bin/env bash

__filename="$(basename "$0")";

convert() {
	html="$(readlink -f "$1")";
	if [[ "${html}" =~ src/nodes/locales/ ]]; then
		if [[ "${html}" =~ .html$ ]]; then
			md=$(echo "${html}" | sed 's|\(.*\)src/nodes/locales/\(.*\)\.html$|\1docs/\2.md|');
			dest_file="$(basename "$md" .md)";
			dest_dir="$(dirname "${md}")";
			if [ ! -d "${dest_dir}" ]; then
				mkdir -p "${dest_dir}";
			fi
			echo -e "## ${dest_file}\n\n" > "${md}";
			cat "${html}" >> "${md}";
			sed -i '4d;$d' "${md}";
		fi
	fi
}

if [ "${__filename}" == 'pre-commit' ]; then
	changed_files="$(git diff --name-only HEAD~1 HEAD)";
	for file in ${changed_files}; do
		convert "${file}";
	done
else
	if [ "$1" == "init" ]; then
		echo ln -s "$(readlink -f "$0")" .git/hooks/pre-commit;
	else
		if [ -z "$1" ]; then
			for file in "src/nodes/locales"/**/*.html; do
				convert "$file";
			done
		else
		 	convert "$1";
		fi
	fi
fi
