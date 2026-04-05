export default Object.freeze({
  id: 'auth',
  focus: 'identity, sessions, bootstrap, password policy, convergence fail-closed handling',
  controllers: ['auth.controller', 'auth-admin.controller', 'bootstrap.controller'],
  services: ['auth.service', 'session.service', 'password.service', 'bootstrap.service', 'authz-version.service'],
  corePolicies: [
    'access-policy',
    'session-policy',
    'credential-policy',
    'bootstrap-policy',
    'user-lifecycle-policy',
  ],
});
