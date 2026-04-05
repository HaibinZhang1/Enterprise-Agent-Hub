import auth from './auth/module.js';
import org from './org/module.js';
import skill from './skill/module.js';
import packageDomain from './package/module.js';
import review from './review/module.js';
import install from './install/module.js';
import search from './search/module.js';
import notify from './notify/module.js';
import audit from './audit/module.js';

export const apiDomains = Object.freeze([auth, org, skill, packageDomain, review, install, search, notify, audit]);
