# ClearRun GitHub Action release plan

This file is the publish plan for the composite action staged in [`action/`](../action/). This pull request does not create the public action repository, tags, GitHub releases, or a Marketplace listing.

The action is a composite action. It sets up Node.js 20 and runs `npx -y @clearrun/cli@1.2.0 score`. Action release `1.0.0` and CLI release `1.2.0` are different numbers. Do not tag the action `v1.2.0` to match the CLI.

## What is staged

`action/` is a complete action repository root:

- `action.yml` (name, description, inputs, outputs, branding icon `check-circle`, branding color `blue`)
- `README.md`
- `LICENSE` (MIT)
- `score.js`
- `test/score.test.js`

Copy those files to the root of a new public repository. Copy the contents of `action/`, not the `action` directory as a subfolder. Marketplace reads `action.yml` only when it is at the repository root. A copy that leaves `action.yml` in a subfolder will not list.

## Dedicated repository

Ross does this when he is ready to publish. This repository does not create the new repo.

1. Create a new public repository named `clearrun-action` under the Adepoco organization: `https://github.com/Adepoco/clearrun-action`.
2. Skip the GitHub license picker. `action/LICENSE` is already the MIT license.
3. Copy every file in `action/` to the root of `Adepoco/clearrun-action`, including `test/`.
4. Commit those files on the default branch `main`.
5. Leave `Adepoco/ClearRun` as the product repository. Its action metadata is not at the root, so Marketplace will not list this repository.

After that copy, `Adepoco/clearrun-action` is the published source. Later action changes land there. The copy in this repository is the staging copy for the first publish.

## Version tags

Use semantic versions for the action. Create the tags in `Adepoco/clearrun-action` only.

1. First release tag: `v1.0.0`, on the commit you publish.
2. Moving major tag: `v1`, pointing at the same commit as `v1.0.0`.
3. Workflows should use `Adepoco/clearrun-action@v1`.
4. A later CLI pin that keeps the same inputs is a patch, for example `v1.0.1`. Tag `v1.0.1`, then move `v1` to that commit.
5. Move `v1` only onto `v1.x.x` commits. A breaking input change is `v2.0.0` and a new `v2` tag. Leave `v1` on the last `v1.x.x` commit.
6. Do not create these tags in `Adepoco/ClearRun`.

Commands Ross runs in a clone of `Adepoco/clearrun-action`, after the action files are on `main`:

```bash
git tag v1.0.0
git push origin v1.0.0
git tag v1
git push origin v1
```

Later patch, after the new commit is on `main`:

```bash
git tag v1.0.1
git push origin v1.0.1
git tag -f v1
git push --force origin v1
```

Moving `v1` is the major tag GitHub documents for actions. Do not force-push `main`. If the repository has immutable releases turned on, tags cannot move. In that case, publish the patch tag and tell callers to pin `v1.0.1` until you choose a release process that fits immutable releases.

The Marketplace form publishes the tag typed into the release. It does not create the moving `v1` tag. Create `v1` with the git commands above after `v1.0.0` exists.

Source: [Releasing and maintaining actions](https://docs.github.com/en/actions/how-tos/create-and-publish-actions/release-and-maintain-actions) and [Managing custom actions](https://docs.github.com/en/actions/how-tos/create-and-publish-actions/manage-custom-actions).

## Marketplace category

Primary category: **Code quality**.

The action fails a job when scored files miss a gate. On the Marketplace actions catalog, that kind of check is grouped under Code quality.

Secondary category: **Continuous integration**.

The release form has a second dropdown, Another Category. Choose Continuous integration there so a search for a CI step can find the action.

Use the dropdown labels on the form that day if GitHub has adjusted the spelling. The choice to make is the code quality group first, and the continuous integration group second.

## Clicks Ross makes to publish

Do this as an owner of the Adepoco organization. Publishing asks for two-factor authentication on the account that clicks Publish release.

The click path matches GitHub's current doc: [Publishing actions in GitHub Marketplace](https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace). Re-open that page on the day you publish. The agreement is [GitHub Marketplace Developer Agreement](https://docs.github.com/en/site-policy/github-terms/github-marketplace-developer-agreement).

1. Open `https://github.com/Adepoco/clearrun-action`.
2. Open the file `action.yml` at the root of that repository.
3. In the banner that offers to publish the action, click **Draft a release**.
4. Under **Release Action**, find **Publish this Action to the GitHub Marketplace**.
5. If that checkbox is disabled, the Adepoco organization has not accepted the developer agreement. Click the link **accept the GitHub Marketplace Developer Agreement**. Read the agreement. Click the button that accepts it. An organization owner has to accept it for Adepoco. If you are not an owner, send the owner this Release Action page and ask them to accept the agreement. Then start this list again at step 1.
6. Select **Publish this Action to the GitHub Marketplace**.
7. Wait until the page says **Everything looks good!** If it shows an error, fix `action.yml` in the repository and reload this page before you publish.
8. Open the **Primary Category** dropdown and click **Code quality**.
9. Open the **Another Category** dropdown and click **Continuous integration**.
10. In the tag field, enter `v1.0.0`.
11. In the title field, enter `ClearRun score gate 1.0.0`.
12. In the description field, say that this release runs `@clearrun/cli@1.2.0`, that each scored input spends API credits, that the job uses the caller's runner minutes, and that ClearRun is not a fact-checker.
13. Click **Publish release**. Complete the two-factor prompt.

After the release exists, create the moving `v1` tag with the git commands in the version section. Push `v1` to `Adepoco/clearrun-action`.

## After publish

1. Open the Marketplace page linked from the repository. Confirm the name **ClearRun score gate**, the **Code quality** category, and the README.
2. In a separate repository, a workflow can reference `Adepoco/clearrun-action@v1`. Do not add that workflow to `Adepoco/ClearRun`. A live run spends API credits.
3. The calling repository needs a secret named `CLEARRUN_API_KEY`. This product repository does not store that secret.

## What this change does not do

- It does not create a git tag.
- It does not publish a GitHub release.
- It does not create `Adepoco/clearrun-action`.
- It does not create a Marketplace listing.
- It does not add a workflow that calls the scoring API.
