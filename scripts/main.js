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
  apiKey: getEnvVar('FIREBASE_API_KEY', 'AIzaSy...fallback'),
  authDomain: getEnvVar('FIREBASE_AUTH_DOMAIN', 'reunited-web.firebaseapp.com'),
  projectId: getEnvVar('FIREBASE_PROJECT_ID', 'reunited-web'),
  storageBucket: getEnvVar('FIREBASE_STORAGE_BUCKET', 'reunited-web.firebasestorage.app'),
  messagingSenderId: getEnvVar('FIREBASE_MESSAGING_SENDER_ID', '1045353786748'),
  appId: getEnvVar('FIREBASE_APP_ID', '1:1045353786748:web:df81f8d326d9508d0848f9')
};

firebase.initializeApp(firebaseConfig);

const app = Vue.createApp({
  data() {
    return {
      loading: true,
      mobileMenuOpen: false,
      showLoginModal: false,
      isSigningUp: false,
      floatingItems: [],
      contactForm: {
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: ''
      },
      loginForm: {
        email: '',
        password: ''
      },
      user: null,
      authError: null,
      formspreeUrl: getEnvVar('FORMSPREE_URL', 'https://formspree.io/f/your-form-id'),
      formSubmitting: false,
      formSubmitted: false,
      magicLinkMode: false,
      magicLinkEmail: '',
      magicLinkSending: false,
      magicLinkSent: false,
      forgotPassword: false,
      resetEmail: '',
      passwordResetSending: false,
      passwordResetSent: false,
      showAppleComingSoon: false,
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
      const item = params.get('item');
      let prefilledMessage = "";
      if (claim) {
        prefilledMessage += "Hi, I'd like to claim this *high value* item! " +  "\n";
        prefilledMessage += "Claim ID: " + claim + "\n";
      }
      if (item) {
        prefilledMessage += "Item name: " + decodeURIComponent(item);
      }
      this.contactForm.message = prefilledMessage;
    }
    this.generateFloatingItems();
    firebase.auth().onAuthStateChanged(user => {
      this.user = user;
    });
    this.startLoadingAnimation();
  },
  methods: {
    startLoadingAnimation() {
      const splashLogo = this.$refs.splashLogo;
      const splashText = this.$refs.splashText;
      const splashDot = this.$refs.splashDot;
      const splashDotWrapper = this.$refs.splashDotWrapper;
      const navLogo = this.$refs.navLogo;
      if (!splashLogo || !splashText || !splashDot || !splashDotWrapper || !navLogo) {
        setTimeout(() => { this.loading = false; }, 2000);
        return;
      }
      const ORBIT_RADIUS = 99;
      splashDot.style.left = ORBIT_RADIUS + 'px';
      splashDotWrapper.classList.add('animate-orbit');
      setTimeout(() => {
        splashDotWrapper.classList.remove('animate-orbit');
        const pseudoDot = splashDot.cloneNode(true);
        const dotRect = splashDot.getBoundingClientRect();
        pseudoDot.style.position = 'fixed';
        pseudoDot.style.left = dotRect.left + 'px';
        pseudoDot.style.top = dotRect.top + 'px';
        pseudoDot.style.transform = 'scale(1)';
        pseudoDot.style.transformOrigin = 'center';
        pseudoDot.style.zIndex = '1';
        document.querySelector('.splash-screen').appendChild(pseudoDot);
        splashDot.style.opacity = '0';
        pseudoDot.style.transition = 'transform 1s ease, opacity 1s ease';
        const scaleNeeded = Math.sqrt(
          window.innerWidth ** 2 + window.innerHeight ** 2
        ) / dotRect.width * 1.5;
        setTimeout(() => {
          pseudoDot.style.transform = `scale(${scaleNeeded})`;
        }, 50);
        const splashLogoRect = splashLogo.getBoundingClientRect();
        const navRect = navLogo.getBoundingClientRect();
        const deltaX = navRect.left - splashLogoRect.left;
        const deltaY = navRect.top - splashLogoRect.top;
        splashLogo.style.transition = 'transform 1s ease';
        splashLogo.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.6)`;
        splashLogo.style.transformOrigin = 'top left';
        setTimeout(() => {
          pseudoDot.style.opacity = '0';
          splashLogo.style.opacity = '0';
          const splashScreenEl = document.querySelector('.splash-screen');
          splashScreenEl.style.transition = 'opacity 0.3s ease';
          splashScreenEl.style.opacity = '0';
          setTimeout(() => {
            this.loading = false;
          }, 300);
        }, 1000);
      }, 2500);
    },
    generateFloatingItems() {
      const items = [];
      for (let i = 0; i < 20; i++) {
        const size = Math.random() * 20 + 5;
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const opacity = Math.random() * 0.15 + 0.05;
        const delay = Math.random() * 5;
        const duration = Math.random() * 10 + 10;
        items.push({
          style: {
            width: `${size}px`,
            height: `${size}px`,
            left: `${x}%`,
            top: `${y}%`,
            opacity: opacity,
            backgroundColor: Math.random() > 0.5
              ? 'var(--accent-color)'
              : 'var(--secondary-accent)',
            animationDuration: `${duration}s`,
            animationDelay: `${delay}s`
          }
        });
      }
      this.floatingItems = items;
    },
    toggleMobileMenu() {
      this.mobileMenuOpen = !this.mobileMenuOpen;
    },
    toggleFaq(index) {
      this.faqs[index].isOpen = !this.faqs[index].isOpen;
    },
    toggleMagicLinkMode() {
      this.magicLinkMode = !this.magicLinkMode;
      this.magicLinkSent = false;
      this.forgotPassword = false;
      this.showAppleComingSoon = false;
    },
    submitContactForm() {
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
    submitLoginForm() {
      this.authError = null;
      if (this.isSigningUp) {
        firebase.auth().createUserWithEmailAndPassword(
          this.loginForm.email,
          this.loginForm.password
        )
        .then(() => {
          this.showLoginModal = false;
          this.loginForm = { email: '', password: '' };
        })
        .catch(error => {
          this.authError = error.message;
        });
      } else {
        firebase.auth().signInWithEmailAndPassword(
          this.loginForm.email,
          this.loginForm.password
        )
        .then(() => {
          this.showLoginModal = false;
          this.loginForm = { email: '', password: '' };
        })
        .catch(error => {
          this.authError = error.message;
        });
      }
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
    sendPasswordReset() {
      if (!this.resetEmail) {
        this.authError = "Please enter your email address";
        return;
      }
      this.passwordResetSending = true;
      this.authError = null;
      firebase.auth().sendPasswordResetEmail(this.resetEmail)
      .then(() => {
        this.passwordResetSent = true;
      })
      .catch(error => {
        this.authError = error.message;
      })
      .finally(() => {
        this.passwordResetSending = false;
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
    signInWithTwitter() {
      const provider = new firebase.auth.TwitterAuthProvider();
      firebase.auth().signInWithPopup(provider)
      .then(() => {
        this.showLoginModal = false;
      })
      .catch(error => {
        this.authError = error.message;
      });
    },
    signOut() {
      firebase.auth().signOut().catch(() => {});
    },
    goToSearchPage() {
      window.location.href = "/search.html";
    }
  }
}).mount('#app');

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
