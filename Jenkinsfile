#!/usr/bin/env groovy
pipeline {
    agent any
    environment {
        DOCKERHUB_CREDENTIALS = credentials('dockerhub')
    }
    stages {
        stage('gitclone') {
            steps {
                checkout([$class: 'GitSCM',
                    branches: [[name: '*/main']],
                    userRemoteConfigs: [[
                        url: 'https://github.com/Awter12/dockerize-test-notify.git',
                        credentialsId: 'bret'
                    ]]
                ])
            }
        }
        stage('Build') {
            steps {
                sh 'docker build -t bret77/dockerize-test-notify:latest .'
            }
        }
        stage('Login') {
            steps {
                sh 'echo $DOCKERHUB_CREDENTIALS_PSW | docker login -u $DOCKERHUB_CREDENTIALS_USR --password-stdin'
            }
        }
        stage('Push') {
            steps {
                sh 'docker push bret77/dockerize-test-notify:latest'
            }
        }
        stage('Deploy to Kubernetes') {
            steps {
                withCredentials([file(credentialsId: 'kubeconfig-devops-cluster', variable: 'KUBECONFIG')]) {
                    sh '''
                        kubectl apply -f k8s/configmap.yaml
                        kubectl apply -f k8s/secret.example.yaml
                        kubectl apply -f k8s/deployment.yaml
                        kubectl apply -f k8s/service.yaml
                        kubectl apply -f k8s/ingress.yaml
                        kubectl rollout restart deployment dockerize-test-notify
                        kubectl rollout status deployment dockerize-test-notify
                    '''
                }
            }
        }
    }
    post {
        success {
            slackSend(channel: '#general', color: 'good', message: "Build & Deploy succeeded: ${env.JOB_NAME} #${env.BUILD_NUMBER}")
        }
        failure {
            slackSend(channel: '#general', color: 'danger', message: "Build & Deploy failed: ${env.JOB_NAME} #${env.BUILD_NUMBER}")
        }
        always {
            sh 'docker logout'
        }
    }
}