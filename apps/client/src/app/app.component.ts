import { Component, OnInit } from '@angular/core';
import { environment } from '../environments/environment';
import { GarlandToolsService } from './core/api/garland-tools.service';
import { TranslateService } from '@ngx-translate/core';
import { IpcService } from './core/electron/ipc.service';
import { NavigationEnd, Router } from '@angular/router';
import { AngularFireDatabase } from 'angularfire2/database';
import { faDiscord, faFacebookF, faGithub } from '@fortawesome/fontawesome-free-brands';
import { faBell, faCalculator, faGavel, faMap } from '@fortawesome/fontawesome-free-solid';
import fontawesome from '@fortawesome/fontawesome';
import { distinctUntilChanged } from 'rxjs/operators';
import { Observable } from 'rxjs/Observable';
import { AuthState } from './reducers/auth.reducer';
import { select, Store } from '@ngrx/store';
import { GetUser } from './actions/auth.actions';

declare const ga: Function;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less']
})
export class AppComponent implements OnInit {

  public static LOCALES: string[] = ['en', 'de', 'fr', 'ja', 'pt', 'es'];

  locale: string;

  version = environment.version;

  public overlay = false;

  public windowDecorator = false;

  public overlayOpacity = 1;

  collapsedSidebar = false;

  collapsedAlarmsBar = true;

  public authState$: Observable<AuthState>;

  constructor(private gt: GarlandToolsService, private translate: TranslateService,
              private ipc: IpcService, private router: Router, private firebase: AngularFireDatabase,
              private store: Store<AuthState>) {

    this.authState$ = store.pipe(
      select('auth')
    );

    this.store.dispatch(new GetUser());

    this.gt.preload();
    // Translation
    translate.setDefaultLang('en');
    const lang = localStorage.getItem('locale');
    if (lang !== null) {
      this.use(lang);
    } else {
      this.use(translate.getBrowserLang());
    }
    translate.onLangChange.subscribe(change => {
      this.locale = change.lang;
    });

    fontawesome.library.add(faDiscord, faFacebookF, faGithub, faCalculator, faBell, faMap, faGavel);

    this.firebase.object('maintenance').valueChanges().subscribe(maintenance => {
      if (maintenance && environment.production) {
        this.router.navigate(['maintenance']);
      }
    });

    // Google Analytics
    router.events
      .pipe(
        distinctUntilChanged((previous: any, current: any) => {
          if (current instanceof NavigationEnd) {
            return previous.url === current.url;
          }
          return true;
        })
      ).subscribe((event: any) => {
      this.overlay = event.url.indexOf('?overlay') > -1;
      this.ipc.on('window-decorator', (e, value) => {
        this.windowDecorator = value;
      });
      if (this.overlay) {
        this.ipc.on(`overlay:${this.ipc.overlayUri}:opacity`, (value) => {
          this.overlayOpacity = value;
        });
        this.ipc.send('overlay:get-opacity', { uri: this.ipc.overlayUri });
      }
      ga('set', 'page', event.url);
      ga('send', 'pageview');
    });
  }

  use(lang: string): void {
    if (AppComponent.LOCALES.indexOf(lang) === -1) {
      lang = 'en';
    }
    this.locale = lang;
    localStorage.setItem('locale', lang);
    this.translate.use(lang);
  }

  ngOnInit(): void {
  }

  /**
   * Desktop-specific methods
   */
  closeApp(): void {
    window.close();
  }

  toggleFullscreen(): void {
    this.ipc.send('fullscreen-toggle');
  }

  minimize(): void {
    this.ipc.send('minimize');
  }

  setOverlayOpacity(opacity: number): void {
    this.ipc.send('overlay:set-opacity', { uri: this.ipc.overlayUri, opacity: opacity });
  }

  previousPage(): void {
    window.history.back();
  }

  nextPage(): void {
    window.history.forward();
  }

}