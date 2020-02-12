

## Issues:

- cluster may not be running...
  `dial tcp <ip address>: i/o timeout`

- helm version of kubernetes-helm defaulting to latest, 
  should be `hypnoglow/kubernetes-helm:2.14` (not a big deal, easy to fix.)

- test running locally (with snapshot envs)

```bash
docker run hypnoglow/kubernetes-helm:2.14 sh -c "tail -f /dev/null"
docker exec -it competent_sutherland sh
mkdir /app && cd /app


## Other envs, custom set by us for testing purposes
# export CIRCLE_WORKING_DIRECTORY=/tmp/app
export CIRCLE_WORKING_DIRECTORY=/app
export CIRCLE_PROJECT_REPONAME=quoting-service
export CIRCLE_TAG=v9.1.0-snapshot

export DOCKER_ORG=mojaloop
export RELEASE_TAG=snapshot
export K8_CLUSTER_NAME=kargo
export K8_CLUSTER_SERVER=<redacted>
export K8_RELEASE_NAME=<redacted>
export K8_NAMESPACE=<redacted>
export K8_USER_NAME=<redacted>
export K8_USER_TOKEN=<redacted>
export K8_HELM_CHART_NAME=<redacted>
export AWS_S3_DIR_DEVOPS_DEPLOYMENT_CONFIG_KEYS=<redacted>
export AWS_S3_URI_DEVOPS_DEPLOYMENT_CONFIG=<redacted>
export K8_USER_PEM_KEY_FILENAME=<redacted>
export K8_USER_PEM_CERT_FILENAME=<redacted>
export AWS_S3_DIR_DEVOPS_DEPLOYMENT_CONFIG_HELM=<redacted>
export HELM_VALUE_FILENAME=<redacted>
export AWS_SECRET_ACCESS_KEY=<redacted>
export AWS_ACCESS_KEY_ID=<redacted>

# TODO: not 100% sure
export K8_HELM_CHART_VERSION=v8.7.0

# TODO: figure out the values for this
export HELM_VALUE_SET_VALUES="--set central.centralhub.centralledger.containers.api.image.repository=$DOCKER_ORG/$CIRCLE_PROJECT_REPONAME --set central.centralhub.centralledger.containers.api.image.tag=$CIRCLE_TAG --set central.centralhub.centralledger.containers.admin.image.repository=$DOCKER_ORG/$CIRCLE_PROJECT_REPONAME --set central.centralhub.centralledger.containers.admin.image.tag=$CIRCLE_TAG"


# defaults_deploy_prequisites step:
if [ -z "$K8_USER_TOKEN" ];
then
  echo "Copying K8 keys into $AWS_S3_DIR_DEVOPS_DEPLOYMENT_CONFIG_KEYS folder"
  mkdir -p $CIRCLE_WORKING_DIRECTORY/$AWS_S3_DIR_DEVOPS_DEPLOYMENT_CONFIG_KEYS
  aws s3 cp $AWS_S3_URI_DEVOPS_DEPLOYMENT_CONFIG/$AWS_S3_DIR_DEVOPS_DEPLOYMENT_CONFIG_KEYS/$K8_USER_PEM_KEY_FILENAME $CIRCLE_WORKING_DIRECTORY/$AWS_S3_DIR_DEVOPS_DEPLOYMENT_CONFIG_KEYS/
  aws s3 cp $AWS_S3_URI_DEVOPS_DEPLOYMENT_CONFIG/$AWS_S3_DIR_DEVOPS_DEPLOYMENT_CONFIG_KEYS/$K8_USER_PEM_CERT_FILENAME $CIRCLE_WORKING_DIRECTORY/$AWS_S3_DIR_DEVOPS_DEPLOYMENT_CONFIG_KEYS/
else
  echo "Skipping K8 keys into $AWS_S3_DIR_DEVOPS_DEPLOYMENT_CONFIG_KEYS folder"
fi
echo "Copying Helm value file into $AWS_S3_DIR_DEVOPS_DEPLOYMENT_CONFIG_HELM folder for $K8_RELEASE_NAME release"
mkdir -p $CIRCLE_WORKING_DIRECTORY/$AWS_S3_DIR_DEVOPS_DEPLOYMENT_CONFIG_HELM
aws s3 cp $AWS_S3_URI_DEVOPS_DEPLOYMENT_CONFIG/$AWS_S3_DIR_DEVOPS_DEPLOYMENT_CONFIG_HELM/$HELM_VALUE_FILENAME $CIRCLE_WORKING_DIRECTORY/$AWS_S3_DIR_DEVOPS_DEPLOYMENT_CONFIG_HELM/

# defaults_deploy_config_kubernetes_cluster
echo "Configure Kubernetes cluster ${K8_CLUSTER_NAME}"
kubectl config set-cluster $K8_CLUSTER_NAME --server=$K8_CLUSTER_SERVER --insecure-skip-tls-verify=true

# defaults_deploy_config_kubernetes_credentials
echo "Configure Kubernetes credentials ${K8_USER_NAME}"
if [ ! -z "$K8_USER_TOKEN" ];
then
    echo "Configure Kubernetes credentials ${K8_USER_NAME} using Token"
    kubectl config set-credentials $K8_USER_NAME --token=$K8_USER_TOKEN
else
    echo "Configure Kubernetes credentials ${K8_USER_NAME} using Certs"
    kubectl config set-credentials $K8_USER_NAME --client-certificate=$CIRCLE_WORKING_DIRECTORY/$AWS_S3_DIR_DEVOPS_DEPLOYMENT_CONFIG_KEYS/$K8_USER_PEM_CERT_FILENAME --client-key=$CIRCLE_WORKING_DIRECTORY/$AWS_S3_DIR_DEVOPS_DEPLOYMENT_CONFIG_KEYS/$K8_USER_PEM_KEY_FILENAME
fi

# defaults_deploy_config_kubernetes_context
echo "Configure Kubernetes context ${K8_CLUSTER_NAME}"
kubectl config set-context $K8_CLUSTER_NAME --cluster=$K8_CLUSTER_NAME --user=$K8_USER_NAME --namespace=$K8_NAMESPACE

# defaults_deploy_set_kubernetes_context
echo "Configure Kubernetes context ${K8_CLUSTER_NAME}"
kubectl config use-context $K8_CLUSTER_NAME

# defaults_deploy_configure_helm
helm init --client-only

# defaults_deploy_install_or_upgrade_helm_chart

# TODO: this is where it all falls over, I think because there is no cluster!
echo "Install or Upgrade Chart ${K8_RELEASE_NAME} for Docker Image ${DOCKER_ORG}/${CIRCLE_PROJECT_REPONAME}:${CIRCLE_TAG}"
if [ -z "$(helm list -q | grep -E "^${K8_RELEASE_NAME}$")"  ] && [ "$(helm list -q | grep -E "^${K8_RELEASE_NAME}$")" != "Error: Unauthorized" ];
then
    echo "Installing ${K8_RELEASE_NAME} new release"
    helm install --namespace=$K8_NAMESPACE --name=$K8_RELEASE_NAME --repo=$K8_HELM_REPO --version $K8_HELM_CHART_VERSION $HELM_VALUE_SET_VALUES -f $CIRCLE_WORKING_DIRECTORY/$AWS_S3_DIR_DEVOPS_DEPLOYMENT_CONFIG_HELM/$HELM_VALUE_FILENAME $K8_HELM_CHART_NAME
else
    echo "Upgrading ${K8_RELEASE_NAME} release"
    helm upgrade $K8_RELEASE_NAME --repo=$K8_HELM_REPO --version $K8_HELM_CHART_VERSION --reuse-values $HELM_VALUE_SET_VALUES -f $CIRCLE_WORKING_DIRECTORY/$AWS_S3_DIR_DEVOPS_DEPLOYMENT_CONFIG_HELM/$HELM_VALUE_FILENAME $K8_HELM_CHART_NAME
fi

```