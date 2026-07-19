import sys

data = open('/tmp/emrapi2/config.xml').read()
old = '<require_module version="${reportingModuleVersion}">org.openmrs.module.reporting</require_module>\n'
data = data.replace(old, '')
open('/tmp/emrapi2/config.xml', 'w').write(data)
print('Done - removed reporting dependency')
