import {Component, Inject, OnInit, ViewChild} from '@angular/core';
import {UserApi} from '../../../shared/sdk/services/custom/User';
import {DOCUMENT} from '@angular/common';
import {AccessToken, User} from '../../../shared/sdk/models';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {

  private user: User;

  @ViewChild('updatePasswordModal') updatePasswordModal: any;
  @ViewChild('updateUserModal') updateUserModal: any;
  @ViewChild('confirmModal') confirmModal: any;

  private devAccessTokens = [];
  private devAccessTokenToRemove: AccessToken = new AccessToken();
  private callbackURL;

  private oldPassword;
  private newPassword;
  private newPasswordConfirm;
  private successMessage;
  private errorMessage;

  constructor(@Inject(DOCUMENT) private document: any,
              private userApi: UserApi) {
  }

  getUser(): void {
    this.user = this.userApi.getCachedCurrent();
    /*this.userApi.findById(this.userApi.getCachedCurrent().id).subscribe((user: User) => {
      this.user = user;
      console.log(this.user);
    });*/
  }

  getDevAccessToken(): void {
    this.userApi.getAccessTokens(this.user.id, {
      where: {
        ttl: -1,
        userId: this.user.id
      }
    }).subscribe((accessTokens: AccessToken[]) => {
      if (accessTokens) {
        console.log(accessTokens);
        this.devAccessTokens = accessTokens;
      }
    });
  }

  createDevAccessToken(): void {
    const newAccessToken = {
      ttl: -1
    };
    this.userApi.createAccessTokens(this.user.id, newAccessToken).subscribe((accessToken: AccessToken) => {
      this.devAccessTokens.push(accessToken);
    });
  }

  showRemoveModal(devAccessToken: AccessToken): void {
    this.confirmModal.show();
    this.devAccessTokenToRemove = devAccessToken;
  }

  remove(): void {
    this.userApi.destroyByIdAccessTokens(this.user.id, this.devAccessTokenToRemove.id).subscribe(value => {
        const index = this.devAccessTokens.indexOf(this.devAccessTokenToRemove);
        this.devAccessTokens.splice(index, 1);
      }
    );/*
    this.userApi.deleteAccessTokens(this.devAccessTokenToRemove.id).subscribe(value => {
        const index = this.devAccessTokens.indexOf(this.devAccessTokenToRemove);
        this.devAccessTokens.splice(index, 1);
      }
    );*/
    this.confirmModal.hide();
  }

  saveSigfoxBackendApiAccess(): void {
    this.userApi.patchAttributes(
      this.user.id,
      {
        'sigfoxBackendApiLogin': this.user.sigfoxBackendApiLogin,
        'sigfoxBackendApiPassword': this.user.sigfoxBackendApiPassword
      }
    ).subscribe();
  }

  removeSigfoxBackendApiAccess(): void {
    this.userApi.patchAttributes(
      this.user.id,
      {
        'sigfoxBackendApiLogin': null,
        'sigfoxBackendApiPassword': null
      }
    ).subscribe((user: User) => {
      this.user = user;
    });
  }

  updatePassword(): void {
    this.errorMessage = '';
    this.successMessage = '';
    if (this.newPassword === this.newPasswordConfirm) {
      this.userApi.changePassword(this.oldPassword, this.newPassword).subscribe((result: any) => {
        console.log(result.message);
        this.successMessage = 'Password was modified successfully.';
        this.updatePasswordModal.hide();
      }, (error: any) => {
        this.errorMessage = error.message;
      });
    } else {
      this.errorMessage = 'Please make sure the passwords match.';
    }
  }

  updateUser(): void {
    this.userApi.patchAttributes(
      this.user.id,
      {
        'email': this.user.email,
        'username': this.user.username,
        'avatar': this.user.avatar
      }
    ).subscribe((user: User) => {
      this.user = user;
      this.updateUserModal.hide();
    });
  }

  ngOnInit() {
    // Get the logged in User object (avatar, email, ...)
    this.getUser();
    this.getDevAccessToken();
    this.callbackURL = this.document.location.origin + '/api/Messages/sigfox';
    //this.accessTokens = this.user.accessTokens;
  }

  ngOnDestroy() {

  }
}
