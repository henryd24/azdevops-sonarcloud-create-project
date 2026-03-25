# SonarCloud Project Creator & Checker

This Azure DevOps extension automates the verification and creation of projects in **SonarCloud**. It ensures your CI/CD pipelines run smoothly by pre-configuring projects, Quality Gates, and New Code definitions before the analysis begins. This extension is designed to help with [SonarCloud](https://sonarcloud.io/) by providing a helper task. It's not an official SonarSource extension.

## 🚀 Why use this task?

Standard SonarCloud analysis often relies on projects being manually created or using default settings. This task provides:

  * **Auto-Provisioning:** Creates the project if it doesn't exist.
  * **Standardization:** Automatically applies the correct Quality Gate and "New Code" definition.
  * **Smart Verification:** Can be used just to check if a project exists without creating it.

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

-----

## ⚙️ Input Configuration

### Core Settings

| Input Label | Parameter Name | Required | Description |
| :--- | :--- | :---: | :--- |
| **SonarCloud Service Connection** | `SonarCloud` | Yes | The Azure DevOps Service Connection for SonarCloud. |
| **Organization** | `sonarOrganization` | Yes | Select or enter the SonarCloud organization key. |
| **Project keyname** | `serviceKey` | Yes | Unique identifier for the project (e.g., `front-angular`). |
| **Project name** | `serviceName` | No | Human-readable name displayed in SonarCloud. |
| **Create project** | `createProject` | Yes | `Yes` to create if missing; `No` to only check existence. |

### Project Customization (Visible when Create Project = Yes)

| Input Label | Parameter Name | Required | Description |
| :--- | :--- | :---: | :--- |
| **Main Branch Name** | `mainBranch` | No | Default branch name (e.g., `trunk`, `release`). |
| **Visibility** | `visibility` | Yes | Project visibility: `private` or `public`. |
| **Tags** | `tags` | No | Comma-separated tags (e.g., `dev,node,aws`). |
| **Long-lived branches (regex)** | `long_live_branches` | No | Regex for long-lived branches (e.g., `(master\|qa)`). |
| **Select the quality gate** | `sonarQualityGate` | No | Select the Quality Gate to assign to the project. |

### New Code Definition (Advanced)

Found under the **Code Definition Options** group. Visible when `createProject` is enabled.

| Input Label | Parameter Name | Type | Description |
| :--- | :--- | :---: | :--- |
| **Configure New Code Definition** | `enableNewCodeDefinition` | boolean | Enables the "New Code" configuration group. |
| **New Code Definition Type** | `newCodeDefinitionType` | radio | `previous_version`, `days`, `date`, or `version`. |
| **New Code Definition Value** | `newCodeDefinitionValue` | string | Required if type is NOT `previous_version`. |

-----

## 🖼️ Preview
### General Setup
![Task View](https://i.imgur.com/6cEiX1l.png)
### Detailed Inputs
![Inputs](https://i.imgur.com/bwzcfpc.png)

-----

## 💻 Technical Requirements

  * **Runtime:** Compatible with agents running **Node 20** or **Node 24**.
  * **Permissions:** The token used in the Service Connection must have **"Administer Projects"** permissions in SonarCloud.

