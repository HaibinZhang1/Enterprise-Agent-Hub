import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
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
  @RequireMenuPermission('admin_departments')
  listDepartments(@Req() request: P1AuthenticatedRequest) {
    return this.adminService.listDepartments(request.p1UserID ?? '');
  }

  @Post('departments')
  @RequireMenuPermission('admin_departments')
  createDepartment(@Req() request: P1AuthenticatedRequest, @Body() body: { parentDepartmentID?: string; name?: string }) {
    return this.adminService.createDepartment(request.p1UserID ?? '', body);
  }

  @Patch('departments/:departmentID')
  @RequireMenuPermission('admin_departments')
  updateDepartment(
    @Req() request: P1AuthenticatedRequest,
    @Param('departmentID') departmentID: string,
    @Body() body: { name?: string },
  ) {
    return this.adminService.updateDepartment(request.p1UserID ?? '', departmentID, body);
  }

  @Delete('departments/:departmentID')
  @RequireMenuPermission('admin_departments')
  deleteDepartment(@Req() request: P1AuthenticatedRequest, @Param('departmentID') departmentID: string) {
    return this.adminService.deleteDepartment(request.p1UserID ?? '', departmentID);
  }

  @Get('users')
  @RequireMenuPermission('admin_users')
  listUsers(@Req() request: P1AuthenticatedRequest) {
    return this.adminService.listUsers(request.p1UserID ?? '');
  }

  @Post('users')
  @RequireMenuPermission('admin_users')
  createUser(
    @Req() request: P1AuthenticatedRequest,
    @Body()
    body: {
      username?: string;
      phoneNumber?: string;
      password?: string;
      departmentID?: string;
      role?: 'normal_user' | 'admin';
      adminLevel?: number | null;
    },
  ) {
    return this.adminService.createUser(request.p1UserID ?? '', body);
  }

  @Patch('users/:phoneNumber')
  @RequireMenuPermission('admin_users')
  updateUser(
    @Req() request: P1AuthenticatedRequest,
    @Param('phoneNumber') phoneNumber: string,
    @Body()
    body: {
      username?: string;
      phoneNumber?: string;
      departmentID?: string;
      role?: 'normal_user' | 'admin';
      adminLevel?: number | null;
    },
  ) {
    return this.adminService.updateUser(request.p1UserID ?? '', phoneNumber, body);
  }

  @Post('users/:phoneNumber/password')
  @RequireMenuPermission('admin_users')
  changeUserPassword(
    @Req() request: P1AuthenticatedRequest,
    @Param('phoneNumber') phoneNumber: string,
    @Body() body: { password?: string },
  ) {
    return this.adminService.changeUserPassword(request.p1UserID ?? '', phoneNumber, body);
  }

  @Post('users/:phoneNumber/freeze')
  @RequireMenuPermission('admin_users')
  freezeUser(@Req() request: P1AuthenticatedRequest, @Param('phoneNumber') phoneNumber: string) {
    return this.adminService.freezeUser(request.p1UserID ?? '', phoneNumber, 'frozen');
  }

  @Post('users/:phoneNumber/unfreeze')
  @RequireMenuPermission('admin_users')
  unfreezeUser(@Req() request: P1AuthenticatedRequest, @Param('phoneNumber') phoneNumber: string) {
    return this.adminService.freezeUser(request.p1UserID ?? '', phoneNumber, 'active');
  }

  @Delete('users/:phoneNumber')
  @RequireMenuPermission('admin_users')
  deleteUser(@Req() request: P1AuthenticatedRequest, @Param('phoneNumber') phoneNumber: string) {
    return this.adminService.deleteUser(request.p1UserID ?? '', phoneNumber);
  }

  @Get('skills')
  @RequireMenuPermission('admin_skills')
  listSkills(@Req() request: P1AuthenticatedRequest) {
    return this.adminService.listSkills(request.p1UserID ?? '');
  }

  @Post('skills/:skillID/delist')
  @RequireMenuPermission('admin_skills')
  delistSkill(@Req() request: P1AuthenticatedRequest, @Param('skillID') skillID: string) {
    return this.adminService.setSkillStatus(request.p1UserID ?? '', skillID, 'delisted');
  }

  @Post('skills/:skillID/relist')
  @RequireMenuPermission('admin_skills')
  relistSkill(@Req() request: P1AuthenticatedRequest, @Param('skillID') skillID: string) {
    return this.adminService.setSkillStatus(request.p1UserID ?? '', skillID, 'published');
  }

  @Delete('skills/:skillID')
  @RequireMenuPermission('admin_skills')
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

  @Get('reviews/:reviewID/files')
  @RequireMenuPermission('review')
  listReviewFiles(@Req() request: P1AuthenticatedRequest, @Param('reviewID') reviewID: string) {
    return this.publishingService.listReviewFiles(request.p1UserID ?? '', reviewID);
  }

  @Get('reviews/:reviewID/file-content')
  @RequireMenuPermission('review')
  reviewFileContent(
    @Req() request: P1AuthenticatedRequest,
    @Param('reviewID') reviewID: string,
    @Query('path') relativePath: string,
  ) {
    return this.publishingService.getReviewFileContent(request.p1UserID ?? '', reviewID, relativePath);
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
