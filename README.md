# SonarCloud Project Creator & Checker

This Azure DevOps extension automates the verification and creation of projects in **SonarCloud**. It ensures your CI/CD pipelines run smoothly by pre-configuring projects, Quality Gates, and New Code definitions before the analysis begins. This extension is designed to help with [SonarCloud](https://sonarcloud.io/) by providing a helper task. It's not an official SonarSource extension.

## 🚀 Why use this task?

Standard SonarCloud analysis often relies on projects being manually created or using default settings. This task provides:

  * **Auto-Provisioning:** Creates the project if it doesn't exist.
  * **Standardization:** Automatically applies the correct Quality Gate and "New Code" definition.
  * **Smart Verification:** Can be used just to check if a project exists without creating it.
  * **Idempotent:** Reads the current configuration and only applies what differs. Safe to run on every pipeline execution.
  * **Dry run:** Preview the changes without creating or modifying anything.
  * **SCM agnostic:** Works with Azure Repos, GitHub, GitLab, Bitbucket, etc.

## 🛠️ Recommended Usage

Place this task **before** the `Prepare Analysis Configuration` task from SonarSource. This ensures the environment is perfectly configured when the scanner starts.

```yaml
- task: sonarcloud-create-project@1
  inputs:
    SonarCloud: 'MySonarConnection'
    sonarOrganization: 'my-org-key'
    serviceKey: 'my-project-key'
    serviceName: 'My Project Name'
    createProject: 'true'
```

### Full example

```yaml
- task: sonarcloud-create-project@1
  name: sonarSetup
  inputs:
    SonarCloud: 'MySonarConnection'
    sonarOrganization: 'my-org-key'
    serviceKey: 'my-project-key'          # optional: defaults to <organization>_<repository name>
    serviceName: 'My Project Name'
    createProject: 'true'
    visibility: 'private'
    mainBranch: 'main'
    tags: 'backend,node'
    long_live_branches: '(main|release/.*)'
    sonarQualityGate: 'Company way'       # id or name
    additionalSettings: |
      sonar.exclusions=**/test/**,**/*.spec.ts
      sonar.coverage.exclusions=**/migrations/**
    qualityProfiles: |
      ts=Company way
      js=Company way
    permissionTemplate: 'Default template' # applied only when the project is created
    groupPermissions: |
      developers=user,codeviewer
      leads=issueadmin,securityhotspotadmin
    failOnConfigError: true

- script: echo "Project $(sonarSetup.SonarProjectKey) created now: $(sonarSetup.SonarProjectCreated)"
```

-----

## ⚙️ Input Configuration

### Core Settings

| Input Label | Parameter Name | Required | Description |
| :--- | :--- | :---: | :--- |
| **SonarCloud Service Connection** | `SonarCloud` | Yes | The Azure DevOps Service Connection for SonarCloud. |
| **Organization** | `sonarOrganization` | Yes | Select or enter the SonarCloud organization key. |
| **Project keyname** | `serviceKey` | No | Unique identifier for the project (e.g., `front-angular`). If empty, it is derived as `<organization>_<repository name>` from `Build.Repository.Name`. |
| **Project name** | `serviceName` | No | Human-readable name displayed in SonarCloud. |
| **Create project** | `createProject` | Yes | `Yes` to create if missing; `No` to only check existence. |

### Project Customization (Visible when Create Project = Yes)

| Input Label | Parameter Name | Required | Description |
| :--- | :--- | :---: | :--- |
| **Main Branch Name** | `mainBranch` | No | Default branch name (e.g., `trunk`, `release`). |
| **Visibility** | `visibility` | Yes | Project visibility used on creation: `private` or `public`. |
| **Enforce visibility on existing projects** | `enforceVisibility` | No | Also update the visibility of projects that already exist. Default `false`. |
| **Tags** | `tags` | No | Comma-separated tags (e.g., `dev,node,aws`). |
| **Long-lived branches (regex)** | `long_live_branches` | No | Regex for long-lived branches (e.g., `(master\|qa)`). |
| **Select the quality gate** | `sonarQualityGate` | No | Quality Gate to assign to the project, by id or name. |

### New Code Definition (Advanced)

Found under the **Code Definition Options** group. Visible when `createProject` is enabled.

| Input Label | Parameter Name | Type | Description |
| :--- | :--- | :---: | :--- |
| **Configure New Code Definition** | `enableNewCodeDefinition` | boolean | Enables the "New Code" configuration group. |
| **New Code Definition Type** | `newCodeDefinitionType` | radio | `previous_version`, `days`, `date`, or `version`. |
| **New Code Definition Value** | `newCodeDefinitionValue` | string | Required if type is NOT `previous_version`. `days`: positive integer, `date`: `YYYY-MM-DD`, `version`: version string. |

### Advanced Configuration

| Input Label | Parameter Name | Description |
| :--- | :--- | :--- |
| **Additional settings** | `additionalSettings` | One `key=value` per line with any project setting (e.g. `sonar.exclusions`, `sonar.cpd.exclusions`). Multi-value settings accept comma-separated values. Explicit inputs (long-lived branches, new code) take precedence. |
| **Quality profiles** | `qualityProfiles` | One `language=Profile name` per line (language keys: `js`, `ts`, `java`, `cs`, `py`, ...). |
| **Permission template** | `permissionTemplate` | Template applied **only when the project is created** by the task. |
| **Group permissions** | `groupPermissions` | One `group=perm1,perm2` per line. Permissions: `admin`, `codeviewer`, `issueadmin`, `securityhotspotadmin`, `scan`, `user`. Only missing permissions are granted. |
| **User permissions** | `userPermissions` | One `login=perm1,perm2` per line. Same permissions as above. |

### Execution Options

| Input Label | Parameter Name | Description |
| :--- | :--- | :--- |
| **Dry run** | `dryRun` | Logs the changes that would be applied without creating or modifying anything. |
| **Fail on configuration errors** | `failOnConfigError` | Fails the task if any configuration step fails. By default the task ends as *Succeeded with issues*. |

### Output variables

| Name | Description |
| :--- | :--- |
| `SonarProjectKey` | Key of the project (useful when it is derived from the repository name). |
| `SonarProjectUrl` | URL of the project overview. |
| `SonarProjectExists` | `true` if the project existed before the task ran. |
| `SonarProjectCreated` | `true` if the project was created by this task. |

-----

## 🖼️ Preview
### General Setup
![Task View](https://i.imgur.com/6cEiX1l.png)
### Detailed Inputs
![Inputs](https://i.imgur.com/bwzcfpc.png)

-----

## 💻 Technical Requirements

  * **Runtime:** Compatible with agents running **Node 20** or **Node 24**.
  * **Permissions:** The token used in the Service Connection must have **"Administer Projects"** permissions in SonarCloud (and **"Create Projects"** to create them).
  * **Regions:** The URL of the service connection is used, so both `https://sonarcloud.io` and the US region `https://sonarqube.us` are supported.
  * **Web API v2:** The Quality Gate is associated through the Web API v2 (`api.sonarcloud.io` / `api.sonarqube.us`), since the v1 `api/qualitygates/*` endpoints are deprecated since September 2025. If the v2 API is not reachable, the task falls back to v1.
  * **Resilience:** API calls use a 30s timeout and retry with exponential backoff on network errors, HTTP 429 and 5xx.

