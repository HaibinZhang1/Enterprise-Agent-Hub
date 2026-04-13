import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { MenuPermissionGuard } from '../auth/menu-permission.guard';
import { P1AuthenticatedRequest, P1AuthGuard } from '../auth/p1-auth.guard';
import { RequireMenuPermission } from '../auth/require-menu-permission.decorator';
import { PublishingService } from '../publishing/publishing.service';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(P1AuthGuard, MenuPermissionGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly publishingService: PublishingService,
  ) {}

  @Get('departments')
  @RequireMenuPermission('manage')
  listDepartments(@Req() request: P1AuthenticatedRequest) {
    return this.adminService.listDepartments(request.p1UserID ?? '');
  }

  @Post('departments')
  @RequireMenuPermission('manage')
  createDepartment(@Req() request: P1AuthenticatedRequest, @Body() body: { parentDepartmentID?: string; name?: string }) {
    return this.adminService.createDepartment(request.p1UserID ?? '', body);
  }

  @Patch('departments/:departmentID')
  @RequireMenuPermission('manage')
  updateDepartment(
    @Req() request: P1AuthenticatedRequest,
    @Param('departmentID') departmentID: string,
    @Body() body: { name?: string },
  ) {
    return this.adminService.updateDepartment(request.p1UserID ?? '', departmentID, body);
  }

  @Delete('departments/:departmentID')
  @RequireMenuPermission('manage')
  deleteDepartment(@Req() request: P1AuthenticatedRequest, @Param('departmentID') departmentID: string) {
    return this.adminService.deleteDepartment(request.p1UserID ?? '', departmentID);
  }

  @Get('users')
  @RequireMenuPermission('manage')
  listUsers(@Req() request: P1AuthenticatedRequest) {
    return this.adminService.listUsers(request.p1UserID ?? '');
  }

  @Post('users')
  @RequireMenuPermission('manage')
  createUser(
    @Req() request: P1AuthenticatedRequest,
    @Body()
    body: {
      username?: string;
      password?: string;
      displayName?: string;
      departmentID?: string;
      role?: 'normal_user' | 'admin';
      adminLevel?: number | null;
    },
  ) {
    return this.adminService.createUser(request.p1UserID ?? '', body);
  }

  @Patch('users/:targetUserID')
  @RequireMenuPermission('manage')
  updateUser(
    @Req() request: P1AuthenticatedRequest,
    @Param('targetUserID') targetUserID: string,
    @Body()
    body: {
      displayName?: string;
      departmentID?: string;
      role?: 'normal_user' | 'admin';
      adminLevel?: number | null;
    },
  ) {
    return this.adminService.updateUser(request.p1UserID ?? '', targetUserID, body);
  }

  @Post('users/:targetUserID/freeze')
  @RequireMenuPermission('manage')
  freezeUser(@Req() request: P1AuthenticatedRequest, @Param('targetUserID') targetUserID: string) {
    return this.adminService.freezeUser(request.p1UserID ?? '', targetUserID, 'frozen');
  }

  @Post('users/:targetUserID/unfreeze')
  @RequireMenuPermission('manage')
  unfreezeUser(@Req() request: P1AuthenticatedRequest, @Param('targetUserID') targetUserID: string) {
    return this.adminService.freezeUser(request.p1UserID ?? '', targetUserID, 'active');
  }

  @Delete('users/:targetUserID')
  @RequireMenuPermission('manage')
  deleteUser(@Req() request: P1AuthenticatedRequest, @Param('targetUserID') targetUserID: string) {
    return this.adminService.deleteUser(request.p1UserID ?? '', targetUserID);
  }

  @Get('skills')
  @RequireMenuPermission('manage')
  listSkills(@Req() request: P1AuthenticatedRequest) {
    return this.adminService.listSkills(request.p1UserID ?? '');
  }

  @Post('skills/:skillID/delist')
  @RequireMenuPermission('manage')
  delistSkill(@Req() request: P1AuthenticatedRequest, @Param('skillID') skillID: string) {
    return this.adminService.setSkillStatus(request.p1UserID ?? '', skillID, 'delisted');
  }

  @Post('skills/:skillID/relist')
  @RequireMenuPermission('manage')
  relistSkill(@Req() request: P1AuthenticatedRequest, @Param('skillID') skillID: string) {
    return this.adminService.setSkillStatus(request.p1UserID ?? '', skillID, 'published');
  }

  @Delete('skills/:skillID')
  @RequireMenuPermission('manage')
  archiveSkill(@Req() request: P1AuthenticatedRequest, @Param('skillID') skillID: string) {
    return this.adminService.setSkillStatus(request.p1UserID ?? '', skillID, 'archived');
  }

  @Get('reviews')
  @RequireMenuPermission('review')
  listReviews(@Req() request: P1AuthenticatedRequest) {
    return this.publishingService.listReviews(request.p1UserID ?? '');
  }

  @Get('reviews/:reviewID')
  @RequireMenuPermission('review')
  getReview(@Req() request: P1AuthenticatedRequest, @Param('reviewID') reviewID: string) {
    return this.publishingService.getReview(request.p1UserID ?? '', reviewID);
  }

  @Post('reviews/:reviewID/claim')
  @RequireMenuPermission('review')
  claimReview(@Req() request: P1AuthenticatedRequest, @Param('reviewID') reviewID: string) {
    return this.publishingService.claimReview(request.p1UserID ?? '', reviewID);
  }

  @Post('reviews/:reviewID/pass-precheck')
  @RequireMenuPermission('review')
  passPrecheck(
    @Req() request: P1AuthenticatedRequest,
    @Param('reviewID') reviewID: string,
    @Body() body: { comment?: string },
  ) {
    return this.publishingService.passPrecheck(request.p1UserID ?? '', reviewID, body.comment ?? '');
  }

  @Post('reviews/:reviewID/approve')
  @RequireMenuPermission('review')
  approveReview(
    @Req() request: P1AuthenticatedRequest,
    @Param('reviewID') reviewID: string,
    @Body() body: { comment?: string },
  ) {
    return this.publishingService.approveReview(request.p1UserID ?? '', reviewID, body.comment ?? '');
  }

  @Post('reviews/:reviewID/return')
  @RequireMenuPermission('review')
  returnReview(
    @Req() request: P1AuthenticatedRequest,
    @Param('reviewID') reviewID: string,
    @Body() body: { comment?: string },
  ) {
    return this.publishingService.returnReview(request.p1UserID ?? '', reviewID, body.comment ?? '');
  }

  @Post('reviews/:reviewID/reject')
  @RequireMenuPermission('review')
  rejectReview(
    @Req() request: P1AuthenticatedRequest,
    @Param('reviewID') reviewID: string,
    @Body() body: { comment?: string },
  ) {
    return this.publishingService.rejectReview(request.p1UserID ?? '', reviewID, body.comment ?? '');
  }
}
