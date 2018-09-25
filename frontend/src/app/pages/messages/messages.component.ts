import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {Connector, Device, FireLoopRef, Geoloc, Message, Organization, User} from '../../shared/sdk/models';
import {RealTime, UserApi} from '../../shared/sdk/services';
import {Subscription} from 'rxjs/Subscription';
import {Reception} from '../../shared/sdk/models/Reception';
import {ReceptionApi} from '../../shared/sdk/services/custom/Reception';
import {AgmMap} from '@agm/core';
import {ActivatedRoute} from '@angular/router';
import {OrganizationApi} from '../../shared/sdk/services/custom';
import {ToasterConfig, ToasterService} from 'angular2-toaster';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-messages',
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.scss']
})
export class MessagesComponent implements OnInit, OnDestroy {

  private deviceSub: any;
  public user: User;

  @ViewChild('mapModal') mapModal: any;
  @ViewChild('agmMap') agmMap: AgmMap;

  // Flags
  public messagesReady = false;

  public mapLat = 48.856614;
  public mapLng = 2.352222;
  public mapZoom = 10;
  public receptions: any[] = [];
  public geolocs: Geoloc[] = [];

  private primusClient: any;

  private organizationRouteSub: Subscription;
  public messages: Message[] = [];

  public organization: Organization;
  private organizations: Organization[] = [];

  private messageFilter: any;
  private isLimit_100 = false;
  private isLimit_500 = false;
  private isLimit_1000 = false;
  private isLimit_0 = false;

  // Notifications
  private toast;
  private toasterService: ToasterService;
  public toasterconfig: ToasterConfig =
    new ToasterConfig({
      tapToDismiss: true,
      timeout: 5000,
      animation: 'fade'
    });

  private filterQuery = '';

  constructor(private rt: RealTime,
              private userApi: UserApi,
              private organizationApi: OrganizationApi,
              private receptionApi: ReceptionApi,
              toasterService: ToasterService,
              private route: ActivatedRoute) {
    this.toasterService = toasterService;
  }

  ngOnInit(): void {
    console.log('Messages: ngOnInit');
    // Get the logged in User object
    this.user = this.userApi.getCachedCurrent();
    this.subscribe();

    // Check if organization view
    this.organizationRouteSub = this.route.parent.parent.params.subscribe(parentParams => {
      if (parentParams.id) {
        this.userApi.findByIdOrganizations(this.user.id, parentParams.id).subscribe((organization: Organization) => {
          this.organization = organization;
          this.setup();
        });
      } else {
        this.setup();
      }
    });
  }

  setup(): void {
    this.cleanSetup();
    // Get and listen messages
    this.deviceSub = this.route.params.subscribe(params => {
      this.filterQuery = params['id'];
      if (this.filterQuery) {
        this.messageFilter = {
          order: 'createdAt DESC',
          limit: 100,
          include: ['Device', 'Geolocs'],
          where: {
            and: [{deviceId: this.filterQuery}]
          }
        };
      } else {
        this.messageFilter = {
          order: 'createdAt DESC',
          limit: 100,
          include: ['Device', 'Geolocs']
        };
      }

      if (this.organization) {

        this.organizationApi.getFilteredMessages(this.organization.id, this.messageFilter).subscribe((messages: Message[]) => {
          this.messages = messages;
          this.messagesReady = true;
        });
      } else {
        this.userApi.getMessages(this.user.id, this.messageFilter).subscribe((result: any) => {
          this.messages = result;
          this.messagesReady = true;
        });
      }
    });
  }

  ngOnDestroy(): void {
    console.log('Messages: ngOnDestroy');
// Unsubscribe from query parameters
    if (this.organizationRouteSub) this.organizationRouteSub.unsubscribe();

    this.cleanSetup();
  }

  private cleanSetup() {
    if (this.deviceSub) this.deviceSub.unsubscribe();
  }

  deleteMessage(message: Message): void {
    this.userApi.destroyByIdMessages(this.user.id, message.id).subscribe(value => {
      if (this.toast)
        this.toasterService.clear(this.toast.toastId, this.toast.toastContainerId);
      this.toast = this.toasterService.pop('success', 'Success', 'The message has been deleted.');
    }, err => {
      if (this.toast)
        this.toasterService.clear(this.toast.toastId, this.toast.toastContainerId);
      this.toast = this.toasterService.pop('error', 'Error', err.error);
    });
  }

  showMarkers(message: Message): void {
    this.geolocs = [];
    this.receptions = [];
    this.mapZoom = 10;

// Message geoloc
    if (message.Geolocs && message.Geolocs.length > 0) {
      this.geolocs = message.Geolocs;
      this.mapLat = message.Geolocs[0].location.lat;
      this.mapLng = message.Geolocs[0].location.lng;
      // Show map
      this.mapModal.show();
      this.mapModal.onShown.subscribe((reason: string) => {
        this.agmMap.triggerResize();
      });
    }

// Coverage
    this.userApi.getConnectors(this.user.id, {where: {type: 'sigfox-api'}}).subscribe((connectors: Connector[]) => {
      if (connectors.length > 0) {
        // Show map
        this.mapModal.show();
        // Get receptions
        this.receptionApi.getBaseStationsByDeviceId(message.deviceId, message.time).subscribe((receptionsResult: Reception[]) => {
            this.receptions = receptionsResult;
            console.log(this.receptions);
            if (this.receptions.length > 0) {
              this.receptions.forEach((reception, i) => {
                this.receptions[i].lat = Number(reception.lat);
                this.receptions[i].lng = Number(reception.lng);
              });
              if (!message.Geolocs) {
                this.mapLat = this.receptions[0].location.lat;
                this.mapLng = this.receptions[0].location.lng;
              }
              this.mapModal.onShown.subscribe((reason: string) => {
                this.agmMap.triggerResize();
              });
            }
          }, error => {
            console.log(error);
          }
        );
      } else {
        console.log('No Sigfox API connector');
      }
    });
  }

  searchFilter(limit: number) {
    this.messages = [];
    this.messagesReady = false;
    // Reset buttons
    this.isLimit_100 = limit == 100;
    this.isLimit_500 = limit == 500;
    this.isLimit_1000 = limit == 1000;
    this.isLimit_0 = limit == 10000;

    this.messageFilter.limit = limit;

    console.log(this.messageFilter);

    if (this.organization) {
      this.organizationApi.getFilteredMessages(this.organization.id, this.messageFilter).subscribe((messages: Message[]) => {
        this.messages = messages;
        this.messagesReady = true;
      });
    } else {
      this.userApi.getMessages(this.user.id, this.messageFilter).subscribe((messages: Message[]) => {
        this.messages = messages;
        this.messagesReady = true;
      });
    }
  }

  download(): void {

  }

  subscribe(): void {
    const primusURL = environment.PRIMUS_URL || "http://localhost:2333";
    this.primusClient = new Primus(primusURL + "?access_token=" + this.userApi.getCurrentToken().id,
      {
        transformer: 'engine.io',
        reconnect: {
          max: Infinity // Number: The max delay before we try to reconnect.
          , min: 500 // Number: The minimum delay before we try reconnect.
          , retries: 5 // Number: How many times we should try to reconnect.
        }
      });

    // this.primusClient.on('open', () => {
    //   console.log('Messages: connected!!');
    //   this.primusClient.write({
    //     "frontend" : {
    //       "userId": this.user.id,
    //       "page": "message"
    //     }
    //   })
    // });

    this.primusClient.on('data', (data) => {
      const payload = data.payload;
      if (payload)
        if (payload.message)
          if (payload.action == "CREATE") {
            this.messages.unshift(payload.message);
          } else if (payload.action == "DELETE") {
            this.messages = this.messages.filter(function(msg) {
              return msg.id !== payload.message.id;
            });
          }
    });
  }
}