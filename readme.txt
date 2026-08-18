CI/CD Explanation

Unlike the GitHub Actions pipeline in the previous project, this pipeline runs on a self-hosted
 Jenkins instance rather than a cloud-hosted runner — giving full control over the build environment, 
 at the cost of having to manage that environment yourself (installing the Docker CLI, mounting the Docker
 socket, managing plugins). The pipeline is defined in a Jenkinsfile using Declarative Pipeline syntax, which 
 Jenkins reads directly from the repository. On each manual trigger, Jenkins authenticates to the private GitHub 
 repo using a stored Personal Access Token, checks out the code, builds a Docker image from the Dockerfile, logs in 
 to Docker Hub using a separate stored credential, and pushes the resulting image. The post block then reports the outcome
 to Slack via a webhook/bot token, regardless of whether the build succeeded or failed, giving immediate visibility
 into pipeline health without needing to check the Jenkins dashboard directly.


Links

GitHub Repo (private)	https://github.com/Awter12/dockerize-test-notify
Docker Hub Image	https://hub.docker.com/r/bret77/dockerize-test-notify
Jenkins	Running locally via Docker (http://localhost:8080)
Slack Workspace	devops-1ra7213