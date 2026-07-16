Look at the current repository to start.
The idea is to be able to publish a personal env setup script on npm from within this repo.
The maintenance cost of this repo should be low (using renovate, that should be possible).

I'd want to be able to have the following setup:

```npx @jitsedesmet/devenv init ${packagename}```
```npx @jitsedesmet/devenv update```

Calling this should install the devcontainer setup also used in this repo.
This means:
1. We find root of the current git repo this is called from. If we do not find that, we take instead use the `pwd` as directory.
2. We prompt the user that we will init or update the directory we decided above.
3. In case of init, we add the devcontainer.json instantiated with the name provided.
4. In case of update, either update the file with our new file (transferring the name course),
or we prompt the user that they updated the files and ask whether the want to let us merge (M, f, s).  

in case m -- Merge (default)
For devcontainer.json, this merge simply means something allowing the lines of recursively calling
  { ...old, ...new } on the json objects
For all others, some kind of string merge algorithm like a git merge should be performed. (but the merge should always try, it should not exit in a state that denotes user input is needed. If it fails, it fails)

In the case of f (force)
Simply override with the new version, transferring the name

In case of s (skip)
Simply do not update the files that have been updated by the user. 
