


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
    }
    post {
        always {
            sh 'docker logout'
        }
    }
}