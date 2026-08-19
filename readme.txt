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

# Deploy Your Containerized App to Kubernetes

Taking the containerized portfolio/API app (already built and shipped through the Jenkins CI/CD pipeline) and running it on a real Kubernetes cluster — with a Deployment, Service, Ingress, externalized config/secrets, health probes, and a fully automated, zero-downtime deploy triggered by the existing pipeline.

## Links

| Item | Value |
|---|---|
| GitHub Repo | https://github.com/Awter12/dockerize-test-notify (private) |
| Docker Hub Image | docker.io/bret77/dockerize-test-notify:latest |
| Local Cluster | kind (`devops-cluster`) |
| App URL (local) | http://dockerize.local |
| CI/CD | Jenkins (existing pipeline, extended with a Deploy to Kubernetes stage) |

## How to Run It Locally

**Prerequisites:** Docker Desktop, `kubectl`, `kind` installed and on PATH.

```bash
# 1. Create the cluster with Ingress-ready port mappings
kind create cluster --name devops-cluster --config k8s/kind-config.yaml

# 2. Load the app image directly into the cluster (avoids slow registry pulls)
docker pull bret77/dockerize-test-notify:latest
kind load docker-image bret77/dockerize-test-notify:latest --name devops-cluster

# 3. Install the NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s

# 4. Apply the application manifests
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml   # copy from k8s/secret.example.yaml and fill in real values — never commit the real file
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml

# 5. Point the local hostname at your machine (Windows: edit as Administrator)
# Add this line to C:\Windows\System32\drivers\etc\hosts
# 127.0.0.1 dockerize.local

# 6. Confirm it's live
kubectl get pods
curl http://dockerize.local/
```

**To test self-healing:**
```bash
kubectl delete pod <any-pod-name>
kubectl get pods   # a replacement pod appears automatically
```

**To test a zero-downtime rolling update:**
```bash
# In one terminal, keep hitting the app:
while true; do curl -s http://dockerize.local/ready; echo " - $(date +%H:%M:%S)"; sleep 0.5; done

# In another terminal, trigger a rollout:
kubectl rollout restart deployment dockerize-test-notify
kubectl rollout status deployment dockerize-test-notify
```

## Architecture

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

## What I Learned

This project made the gap between "running a container" and "running production infrastructure" concrete in a way 
none of the earlier projects did. The biggest lesson was that Kubernetes doesn't automatically know anything about 
your app beyond what you explicitly tell it — the port it listens on, whether it's healthy, how many copies should
exist — and getting any of that wrong (like assuming the Dockerfile's `EXPOSE` line was the real port, when the actual
port came from an environment variable fallback in the code) breaks things in ways that look like networking bugs but
are really just mismatched assumptions. The self-healing and rolling-update tests were the most rewarding part: watching
a pod get killed and instantly replaced, and watching a curl loop stay unbroken while pods were swapped underneath it, made
Kubernetes' core value proposition click in a way no explanation could have. Wiring the existing Jenkins pipeline into the
cluster (M5) was also a genuine lesson in production-style secrets handling — realizing a `kubeconfig` pointing at `127.0.0.1`
 only works on the machine that generated it, and that container-to-container networking on Docker Desktop needs an explicit 
 shared network and the container's real internal IP, was a debugging exercise that mirrors real infrastructure problems, not
 tutorial problems.
