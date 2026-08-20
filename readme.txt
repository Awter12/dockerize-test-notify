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


--------------------------------------------------------------------------------------------

 Dockerize-Test-Notify — Kubernetes Deployment

Production-style Kubernetes deployment for the `dockerize-test-notify` application. The app is built and pushed to Docker Hub by an existing Jenkins CI/CD pipeline, then deployed to a Kubernetes cluster with a Deployment, Service, Ingress, externalized configuration/secrets, health probes, and a fully automated, zero-downtime release process triggered directly by the pipeline.

 Overview

This deployment demonstrates a complete path from source code to a self-healing, horizontally scaled, externally routable service running on Kubernetes:

| Capability | Implementation |
|---|---|
| Container orchestration | Kubernetes `Deployment` (replacing manual `docker run`) |
| Traffic routing | NGINX Ingress Controller, hostname-based routing |
| Configuration management | Kubernetes `ConfigMap` |
| Secrets management | Kubernetes `Secret`, excluded from version control |
| Reliability | Liveness/readiness probes, resource requests/limits, multi-replica scaling |
| Delivery | Jenkins pipeline stage triggering `kubectl apply` + rollout on every push |

 Architecture

```
Developer
   |
   |  git push (code + Jenkinsfile changes)
   v
GitHub (private repo)
   |
   |  Jenkins pulls Jenkinsfile from SCM, triggers pipeline
   v
Jenkins (running locally in Docker, with Docker CLI + kubectl installed)
   |
   |  1. git clone           -> pulls latest source
   |  2. docker build        -> builds new image
   |  3. docker login/push   -> pushes image to Docker Hub
   v
Docker Hub  (bret77/dockerize-test-notify:latest)
   |
   |  4. kubectl apply + rollout restart (via kubeconfig credential)
   v
kind Kubernetes Cluster (local)
   |
   |-- Deployment (2 replicas, resource limits, liveness/readiness probes)
   |     |-- Pod 1 --\
   |     |-- Pod 2 --+--> Service (ClusterIP, routes traffic to healthy pods)
   |                        |
   |                        v
   |                  Ingress (NGINX controller)
   |                        |
   |                        v
   |                  http://dockerize.local  <-- Developer's browser
   |
   |-- ConfigMap  (PORT, APP_MESSAGE)
   |-- Secret     (API_KEY, kept out of the image and out of git)
```

 Project Links

| Item | Value |
|---|---|
| GitHub Repository | https://github.com/Awter12/dockerize-test-notify (private) |
| Docker Hub Image | `docker.io/bret77/dockerize-test-notify:latest` |
| Local Cluster | kind (`devops-cluster`) |
| Application URL (local) | http://dockerize.local |
| CI/CD | Jenkins (existing pipeline, extended with a **Deploy to Kubernetes** stage) |


 Environment Setup

 1. Provision the cluster

```bash
kind create cluster --name devops-cluster --config k8s/kind-config.yaml
```

The `kind-config.yaml` maps host ports 80/443 into the cluster so the Ingress controller is reachable directly from `localhost`.

 2. Load the application image

```bash
docker pull bret77/dockerize-test-notify:latest
kind load docker-image bret77/dockerize-test-notify:latest --name devops-cluster
```

Loading the image directly into the cluster avoids a registry pull and speeds up pod startup.

 3. Install the NGINX Ingress Controller

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
```

 4. Configure local DNS resolution

Added the following entry to hosts file so `dockerize.local` resolves to the cluster:

- **Windows:** `C:\Windows\System32\drivers\etc\hosts` (edit as Administrator)


```
127.0.0.1 dockerize.local
```

 Deploying the Application

Apply the manifests in the following order:

```bash
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml    
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

 Verification

 Confirmed the deployment live

```bash
kubectl get pods
curl http://dockerize.local/
```

 Validate self-healing

```bash
kubectl delete pod <any-pod-name>
kubectl get pods   # a replacement pod is scheduled automatically
```

 Validate zero-downtime rolling updates

Terminal 1 — continuous traffic:

```bash
while true; do curl -s http://dockerize.local/ready; echo " - $(date +%H:%M:%S)"; sleep 0.5; done
```

Terminal 2 — trigger a rollout:

```bash
kubectl rollout restart deployment dockerize-test-notify
kubectl rollout status deployment dockerize-test-notify
```

Traffic in Terminal 1 continues uninterrupted throughout the rollout.

 Configuration & Secrets Management

- Non-sensitive runtime configuration (`PORT`, `APP_MESSAGE`) is defined in `k8s/configmap.yaml` and injected as environment variables, allowing configuration changes without rebuilding the image.
- Sensitive values (`API_KEY`) are defined in `k8s/secret.yaml`, which is excluded from version control. `k8s/secret.example.yaml` documents the required structure without real values.
- No credentials or environment-specific configuration are baked into the container image.

 CI/CD Integration

The existing Jenkins pipeline is extended with a deployment stage that runs after the image is built and pushed:

1. `git clone` — pulls the latest source and manifests.
2. `docker build` / `docker push` — builds and publishes the updated image to Docker Hub.
3. `kubectl apply` + `kubectl rollout restart` — applies the current manifests and triggers a rolling update on the cluster, authenticated via a securely stored `kubeconfig` credential.

Every push to the repository results in an automated, zero-downtime deployment with no manual intervention.

 Repository Structure

```
.
├── k8s/
│   ├── kind-config.yaml
│   ├── configmap.yaml
│   ├── secret.example.yaml
│   ├── secret.yaml            # not committed
│   ├── deployment.yaml
│   ├── service.yaml
│   └── ingress.yaml
├── Jenkinsfile
└── README.md
```