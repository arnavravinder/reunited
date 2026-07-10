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

const friendlyAuthError = (error) => {
  const code = (error && error.code) || "";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return null;
  if (code === "auth/invalid-email") return "That email does not look quite right.";
  if (code === "auth/network-request-failed") return "Network trouble - check your connection and try again.";
  if (code === "auth/too-many-requests") return "Too many attempts. Give it a minute, then try again.";
  if (code === "auth/unauthorized-domain") return "Sign-in is not available on this address.";
  if (code === "auth/account-exists-with-different-credential") return "That email is linked to Google - use Continue with Google instead.";
  return "Something went wrong. Please try again.";
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const app = Vue.createApp({
  data() {
    return {
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
    this.$nextTick(() => {
      const heroContent = document.querySelector('.hero-content');
      if (heroContent) heroContent.classList.add('revealed');
      this.initScrollFX();
      this.initRevealObserver();
    });
    document.addEventListener('click', this.closeAccountMenuOutside);
  },
  unmounted() {
    document.removeEventListener('click', this.closeAccountMenuOutside);
  },
  methods: {
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
          this.authError = friendlyAuthError(error);
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
          this.authError = friendlyAuthError(error);
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
        this.authError = "That sign-in link did not work. Request a fresh one below."; this.showLoginModal = true;
      });
  }
}
