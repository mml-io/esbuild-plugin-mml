#!/usr/bin/env bash

opts+=(minor premajor prepatch major patch preminor prerelease)

if [ ! -z "$1" ]; then
	if [[ ! "${opts[*]}" =~ "$1" ]]; then
		echo "argument \"$1\" must be one of ${opts[@]}";
		exit 1;
	fi
	npm version $1
	exit $?
fi


if command -v fzf $> /dev/null; then
	npm version $(IFS=$'\n'; echo "${opts[*]}" | fzf --no-clear --height 10  )
	exit
else
select item in minor premajor prepatch major patch preminor prerelease; do
	npm version $item
	break;
done
fi 

