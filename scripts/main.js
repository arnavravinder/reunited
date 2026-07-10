const getEnvVar = (key, defaultValue = null) => {
  if (window.env && window.env[key]) {
    return window.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return defaultValue;
};

const firebaseConfig = {
  apiKey: getEnvVar('FIREBASE_API_KEY'),
  authDomain: getEnvVar('FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvVar('FIREBASE_PROJECT_ID'),
  storageBucket: getEnvVar('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvVar('FIREBASE_APP_ID')
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const app = Vue.createApp({
  data() {
    return {
      loading: true,
      heroQuery: '',
      mobileMenuOpen: false,
      accountMenuOpen: false,
      showLoginModal: false,
      contactForm: {
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: ''
      },
      user: null,
      authError: null,
      formspreeUrl: getEnvVar('FORMSPREE_URL'),
      formSubmitting: false,
      formSubmitted: false,
      magicLinkEmail: '',
      magicLinkSending: false,
      magicLinkSent: false,
      userProfile: {
        displayName: '',
        email: ''
      },
      faqs: [
        {
          question: "How can I post about a lost item on the website?",
          answer: "If you have lost an item, login with your account and scroll to the bottom of the page. Fill in the form to find lost items which match the description of your post.",
          isOpen: false
        },
        {
          question: "What happens if someone loses an expensive item?",
          answer: "If you lose an item of high value such as a phone or a laptop, contact us using the form at the bottom of this page and we will get back to you as soon as possible.",
          isOpen: false
        },
        {
          question: "What happens if an item is not claimed?",
          answer: "Posts remain active for 6 months. If an item is not claimed within this time frame, it will be donated to a local charity or the support staff at workplace.",
          isOpen: false
        },
        {
          question: "How to report a lost item?",
          answer: "To report a lost item, please hand it over to our team at the Lost and Found, located in the lunch hall.",
          isOpen: false
        }
      ]
    };
  },
  mounted() {
    console.log("Are you a developer/do you work in tech? I'm a 16 year old student, and open to exploring opportunities! Please reach out if you can: https://www.linkedin.com/in/arnav-ravinder");
    if (window.location.hash.includes('?')) {
      const queryString = window.location.hash.split('?')[1];
      const params = new URLSearchParams(queryString);
      const claim = params.get('claim');
      const claimId = params.get('claimId');
      const item = params.get('item');
      const issue = params.get('issue');
      let prefilledMessage = "";

      if (claim || claimId) {
        const id = claim || claimId;
        if (issue === 'pickup_dispute') {
          prefilledMessage += "Hi, I need assistance with a pickup dispute.\n";
          this.contactForm.subject = "Pickup Dispute - " + (item ? decodeURIComponent(item) : "Item");
        } else {
          prefilledMessage += "Hi, I'd like to claim this item!\n";
          this.contactForm.subject = "Item Claim - " + (item ? decodeURIComponent(item) : "Item");
        }
        prefilledMessage += "Claim ID: " + id + "\n";
      }

      if (item) {
        prefilledMessage += "Item: " + decodeURIComponent(item) + "\n";
      }

      if (issue && issue !== 'pickup_dispute') {
        prefilledMessage += "Issue type: " + issue.replace(/_/g, ' ') + "\n";
      }

      this.contactForm.message = prefilledMessage;

      if (window.location.hash.includes('contact')) {
        this.$nextTick(() => {
          const contactSection = document.getElementById('contact');
          if (contactSection) {
            contactSection.scrollIntoView({ behavior: 'smooth' });
          }
        });
      }
    }
    firebase.auth().onAuthStateChanged(user => {
      this.user = user;
      if (user) {
        this.loadUserProfile();
      }
    });
    this.startLoadingAnimation();
    this.$nextTick(() => {
      this.initScrollFX();
      this.initRevealObserver();
    });
    document.addEventListener('click', this.closeAccountMenuOutside);
  },
  unmounted() {
    document.removeEventListener('click', this.closeAccountMenuOutside);
  },
  methods: {
    startLoadingAnimation() {
      const appEl = document.getElementById('app');
      const reveal = () => {
        const heroContent = document.querySelector('.hero-content');
        if (heroContent) heroContent.classList.add('revealed');
      };
      const finish = () => {
        document.body.style.overflow = '';
        this.loading = false;
      };

      document.body.style.overflow = 'hidden';

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const seenSplash = sessionStorage.getItem('reunitedSplashSeen');
      sessionStorage.setItem('reunitedSplashSeen', '1');

      const splashLogo = this.$refs.splashLogo;
      const splashDot = this.$refs.splashDot;
      const splashPeriod = this.$refs.splashPeriod;
      const splashRing = this.$refs.splashRing;
      const splashWrapper = this.$refs.splashDotWrapper;
      const navLogo = this.$refs.navLogo;
      const canAnimate = splashLogo && splashDot && splashPeriod && splashRing && splashWrapper && navLogo;

      if (reducedMotion || seenSplash || !canAnimate) {
        const splashEl = document.querySelector('.splash-screen');
        if (splashEl) {
          splashEl.style.transition = 'opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
          requestAnimationFrame(() => { splashEl.style.opacity = '0'; });
        }
        setTimeout(() => {
          finish();
          reveal();
        }, 480);
        return;
      }

      appEl.classList.add('is-loading');
      navLogo.style.transition = 'none';
      navLogo.style.opacity = '0';

      const wrapRect = splashWrapper.getBoundingClientRect();
      const perRect = splashPeriod.getBoundingClientRect();
      const tx = perRect.left + perRect.width / 2 - wrapRect.left;
      const ty = perRect.top + perRect.height * 0.72 - wrapRect.top;

      const targetR = Math.hypot(tx, ty);
      const targetA = Math.atan2(ty, tx);
      const TURNS = 1.25;
      const startA = targetA - TURNS * Math.PI * 2;
      const START_RX = 135;
      const START_RY = 62;
      const ORBIT_MS = 1100;

      const easeOrbit = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      splashRing.style.left = tx + 'px';
      splashRing.style.top = ty + 'px';

      const t0 = performance.now();
      const runOrbit = (now) => {
        const t = Math.min((now - t0) / ORBIT_MS, 1);
        const e = easeOrbit(t);
        const angle = startA + (targetA - startA) * e;
        const rx = START_RX + (targetR - START_RX) * e;
        const ry = START_RY + (targetR - START_RY) * e;
        const x = Math.cos(angle) * rx;
        const y = Math.sin(angle) * ry;
        const scale = 1 - 0.5 * Math.max(0, (t - 0.7) / 0.3);
        splashDot.style.transform = `translate(${x - 7}px, ${y - 7}px) scale(${scale})`;
        if (t < 1) {
          requestAnimationFrame(runOrbit);
        } else {
          dock();
        }
      };
      requestAnimationFrame(runOrbit);

      function dock() {
        splashRing.classList.add('pulse');
        splashDot.style.transition = 'opacity 0.16s ease';
        splashPeriod.style.transition = 'opacity 0.16s ease';
        splashDot.style.opacity = '0';
        splashPeriod.style.opacity = '1';
        setTimeout(handoff, 170);
      }

      function handoff() {
        appEl.classList.remove('is-loading');
        reveal();

        const splashEl = document.querySelector('.splash-screen');
        const sRect = splashLogo.getBoundingClientRect();
        const nRect = navLogo.getBoundingClientRect();
        const dx = nRect.left - sRect.left;
        const dy = nRect.top - sRect.top;
        const sc = nRect.width / sRect.width;

        splashEl.classList.add('splash-clear');
        splashLogo.style.transformOrigin = 'top left';
        splashLogo.style.transition = 'transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)';
        splashLogo.style.transform = `translate(${dx}px, ${dy}px) scale(${sc})`;

        setTimeout(() => {
          navLogo.style.opacity = '';
          finish();
        }, 680);
      }
    },
    initRevealObserver() {
      const els = document.querySelectorAll('[data-reveal]');
      if (!('IntersectionObserver' in window) || !els.length) {
        els.forEach(el => el.setAttribute('data-revealed', ''));
        return;
      }
      const obs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-revealed', '');
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
      els.forEach(el => obs.observe(el));
    },
    initScrollFX() {
      const header = document.querySelector('header');
      if (!header) return;

      let ticking = false;
      const update = () => {
        ticking = false;
        header.classList.toggle('scrolled', window.scrollY > window.innerHeight * 0.6);
      };
      const onScroll = () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      update();
    },
    toggleMobileMenu() {
      this.mobileMenuOpen = !this.mobileMenuOpen;
    },
    closeAccountMenuOutside(event) {
      if (!event.target.closest('.nav-account')) {
        this.accountMenuOpen = false;
      }
    },
    toggleFaq(index) {
      this.faqs[index].isOpen = !this.faqs[index].isOpen;
    },
    submitContactForm(event) {
      this.formSubmitting = true;
      const formData = new FormData(event.target);
      fetch(this.formspreeUrl, {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' }
      })
        .then(response => {
          if (response.ok) {
            this.formSubmitted = true;
            this.contactForm = {
              name: '',
              email: '',
              phone: '',
              subject: '',
              message: ''
            };
          } else {
            throw new Error('Form submission failed');
          }
        })
        .catch(() => {
          alert('There was an error submitting the form. Please try again later.');
        })
        .finally(() => {
          this.formSubmitting = false;
        });
    },
    sendMagicLink() {
      if (!this.magicLinkEmail) {
        this.authError = "Please enter your email address";
        return;
      }
      this.magicLinkSending = true;
      this.authError = null;
      const actionCodeSettings = {
        url: window.location.href,
        handleCodeInApp: true
      };
      firebase.auth().sendSignInLinkToEmail(this.magicLinkEmail, actionCodeSettings)
        .then(() => {
          window.localStorage.setItem('emailForSignIn', this.magicLinkEmail);
          this.magicLinkSent = true;
        })
        .catch(error => {
          this.authError = error.message;
        })
        .finally(() => {
          this.magicLinkSending = false;
        });
    },
    signInWithGoogle() {
      const provider = new firebase.auth.GoogleAuthProvider();
      firebase.auth().signInWithPopup(provider)
        .then(() => {
          this.showLoginModal = false;
        })
        .catch(error => {
          this.authError = error.message;
        });
    },
    signOut() {
      firebase.auth().signOut().catch(() => { });
    },
    loadUserProfile() {
      if (!this.user) return;
      db.collection('users').doc(this.user.uid).get().then(doc => {
        if (doc.exists) {
          const data = doc.data();
          this.userProfile = {
            displayName: data.displayName || this.user.displayName || '',
            email: this.user.email
          };
        } else {
          this.userProfile = {
            displayName: this.user.displayName || '',
            email: this.user.email
          };
        }
      }).catch(error => {

      });
    },
    getProfileInitials(displayName) {
      if (!displayName || displayName.trim().length === 0) {
        return this.user?.email?.charAt(0).toUpperCase() || '?';
      }
      const names = displayName.trim().split(' ');
      if (names.length === 1) {
        return names[0].charAt(0).toUpperCase();
      }
      return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
    },
    getProfilePictureColor(displayName) {
      const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
        '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
        '#10AC84', '#EE5A24', '#0984E3', '#A29BFE', '#FD79A8'
      ];
      const name = displayName || this.user?.email || '';
      const charSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      return colors[charSum % colors.length];
    },
    goToSearchPage() {
      const q = (this.heroQuery || '').trim();
      window.location.href = q ? '/search.html?q=' + encodeURIComponent(q) : '/search.html';
    }
  }
});

app.mount('#app');

if (firebase.auth().isSignInWithEmailLink(window.location.href)) {
  let email = window.localStorage.getItem('emailForSignIn');
  if (!email) {
    email = window.prompt('Please provide your email for confirmation');
  }
  if (email) {
    firebase.auth().signInWithEmailLink(email, window.location.href)
      .then(() => {
        window.localStorage.removeItem('emailForSignIn');
        if (window.history && window.history.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      })
      .catch(() => {
        alert("Error signing in. Please try again.");
      });
  }
}
