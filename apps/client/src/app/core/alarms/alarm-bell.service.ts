import { Injectable } from '@angular/core';
import { EorzeanTimeService } from '../time/eorzean-time.service';
import { AlarmsFacade } from './+state/alarms.facade';
import { combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { Alarm } from './alarm';
import { LocalizedDataService } from '../data/localized-data.service';
import { SettingsService } from '../../pages/settings/settings.service';
import { PlatformService } from '../tools/platform.service';
import { IpcService } from '../electron/ipc.service';
import { TranslateService } from '@ngx-translate/core';
import { PushNotificationsService } from 'ng-push';
import { NzNotificationService } from 'ng-zorro-antd';
import { I18nToolsService } from '../tools/i18n-tools.service';

@Injectable({
  providedIn: 'root'
})
export class AlarmBellService {

  constructor(private eorzeanTime: EorzeanTimeService, private alarmsFacade: AlarmsFacade, private l12n: LocalizedDataService,
              private settings: SettingsService, private platform: PlatformService, private ipc: IpcService,
              private localizedData: LocalizedDataService, private translate: TranslateService, private pushNotificationsService: PushNotificationsService,
              private notificationService: NzNotificationService, private i18n: I18nToolsService) {
    this.initBell();
  }

  private initBell(): void {
    combineLatest(this.eorzeanTime.getEorzeanTime(), this.alarmsFacade.allAlarms$)
      .pipe(
        map(([date, alarms]) => {
          return alarms.filter(alarm => {
            const lastPlayed = this.getLastPlayed(alarm);
            const timeBeforePlay = Math.ceil(this.alarmsFacade.getMinutesBefore(date, alarm.spawn) / 60) - this.settings.alarmHoursBefore;
            // Irl alarm duration in ms
            const irlAlarmDuration = this.eorzeanTime.toEarthTime(alarm.duration * 60) * 1000;
            return Date.now() - lastPlayed >= irlAlarmDuration
              && timeBeforePlay === 0
              && date.getUTCMinutes() === 0;
          });
        })
      ).subscribe(alarmsToPlay => alarmsToPlay.forEach(alarm => {
      if (!this.settings.alarmsMuted) {
        this.ring(alarm);
        this.notify(alarm);
      }
    }));
  }

  /**
   * Plays the sound part of the alarm.
   * @param alarm
   */
  public ring(alarm: Alarm): void {
    //Let's ring the alarm !
    let audio: HTMLAudioElement;
    // If this isn't a file path (desktop app), then take it inside the assets folder.
    if (this.settings.alarmSound.indexOf(':') === -1) {
      audio = new Audio(`./assets/audio/${this.settings.alarmSound}.mp3`);
    } else {
      audio = new Audio(this.settings.alarmSound);
    }
    audio.loop = false;
    audio.volume = this.settings.alarmVolume;
    audio.play();
    localStorage.setItem(`played:${alarm.$key}`, Date.now().toString());
  }

  public notify(alarm: Alarm): void {
    const aetheryteName = this.i18n.getName(this.localizedData.getPlace(alarm.aetheryte.nameid));
    const notificationIcon = `https://www.garlandtools.org/db/icons/item/${alarm.icon}.png`;
    const notificationTitle = this.i18n.getName(this.localizedData.getItem(alarm.itemId));
    const notificationBody = `${this.i18n.getName(this.localizedData.getPlace(alarm.zoneId))} - `
      + `${aetheryteName}` +
      (alarm.slot !== undefined ? ` - Slot ${alarm.slot}` : '');
    if (this.platform.isDesktop()) {

    } else {
      this.pushNotificationsService.create(notificationTitle,
        {
          icon: notificationIcon,
          sticky: false,
          renotify: false,
          body: notificationBody
        }
      );
      this.notificationService.info(notificationTitle, notificationBody);
    }
  }

  private getLastPlayed(alarm: Alarm): number {
    return +(localStorage.getItem(`played:${alarm.$key}`) || 0);
  }
}