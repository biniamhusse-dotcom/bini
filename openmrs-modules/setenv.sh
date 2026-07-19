export JAVA_OPTS="-XX:-UseContainerSupport"
export CATALINA_OPTS="-Xms512m -Xmx2048m -DOPENMRS_INSTALLATION_SCRIPT=/openmrs/openmrs-server.properties -DOPENMRS_APPLICATION_DATA_DIRECTORY=/openmrs/data/ -Dspring.aop.proxyTargetClass=true -Dopenmrs.module.aop.proxyTargetClass=true"
