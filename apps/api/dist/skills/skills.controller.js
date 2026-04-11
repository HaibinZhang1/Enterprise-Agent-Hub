"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillsController = void 0;
const common_1 = require("@nestjs/common");
const skills_service_1 = require("./skills.service");
let SkillsController = class SkillsController {
    skillsService;
    constructor(skillsService) {
        this.skillsService = skillsService;
    }
    list(query) {
        return this.skillsService.list(query);
    }
    detail(skillID) {
        return this.skillsService.detail(skillID);
    }
    downloadTicket(skillID, body) {
        return this.skillsService.downloadTicket(skillID, body);
    }
    star(skillID) {
        return this.skillsService.star(skillID, true);
    }
    unstar(skillID) {
        return this.skillsService.star(skillID, false);
    }
};
exports.SkillsController = SkillsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Object)
], SkillsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':skillID'),
    __param(0, (0, common_1.Param)('skillID')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Object)
], SkillsController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(':skillID/download-ticket'),
    __param(0, (0, common_1.Param)('skillID')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Object)
], SkillsController.prototype, "downloadTicket", null);
__decorate([
    (0, common_1.Post)(':skillID/star'),
    __param(0, (0, common_1.Param)('skillID')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Object)
], SkillsController.prototype, "star", null);
__decorate([
    (0, common_1.Delete)(':skillID/star'),
    __param(0, (0, common_1.Param)('skillID')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Object)
], SkillsController.prototype, "unstar", null);
exports.SkillsController = SkillsController = __decorate([
    (0, common_1.Controller)('skills'),
    __metadata("design:paramtypes", [skills_service_1.SkillsService])
], SkillsController);
