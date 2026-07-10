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
  databaseURL: getEnvVar('FIREBASE_DATABASE_URL'),
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
      user: null,
      authError: null,
      showLoginModal: false,
      magicLinkEmail: '',
      magicLinkSending: false,
      magicLinkSent: false,

      isLoading: true,
      mobileMenuOpen: false,
      accountMenuOpen: false,

      searchQuery: '',
      sortOption: 'date-desc',

      currentPage: 1,
      itemsPerPage: 10,
      totalPages: 1,

      logs: [],
      userProfile: {
        displayName: '',
        email: ''
      }
    };
  },
  computed: {
    filteredLogs() {
      if (!this.searchQuery) {
        return this.logs;
      }
      return this.logs.filter(log => {
        return log.itemName.toLowerCase().includes(this.searchQuery.toLowerCase());
      });
    },
    paginatedLogs() {
      const startIndex = (this.currentPage - 1) * this.itemsPerPage;
      const endIndex = startIndex + this.itemsPerPage;
      return this.filteredLogs.slice(startIndex, endIndex);
    }
  },
  watch: {
    filteredLogs() {
      this.updatePagination();
    },
    searchQuery() {
      this.currentPage = 1;
    },
    sortOption() {
      this.sortLogs();
    }
  },
  mounted() {
    firebase.auth().onAuthStateChanged(user => {
      this.user = user;
      if (user) {
        this.loadUserProfile();
      }
    });

    this.loadPublicLog();

    this.checkMagicLinkSignIn();
    document.addEventListener('click', this.closeAccountMenuOutside);
  },
  unmounted() {
    document.removeEventListener('click', this.closeAccountMenuOutside);
  },
  methods: {
    loadPublicLog() {
      this.isLoading = true;

      db.collection('log')
        .orderBy('claimDate', 'desc')
        .limit(100)
        .get()
        .then(snapshot => {
          this.logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          this.sortLogs();
          this.updatePagination();
        })
        .catch(error => {

        })
        .finally(() => {
          this.isLoading = false;
        });
    },

    sortLogs() {
      switch (this.sortOption) {
        case 'date-desc':
          this.logs.sort((a, b) => {
            const dateA = a.claimDate?.toDate ? a.claimDate.toDate() : new Date(0);
            const dateB = b.claimDate?.toDate ? b.claimDate.toDate() : new Date(0);
            return dateB - dateA;
          });
          break;
        case 'date-asc':
          this.logs.sort((a, b) => {
            const dateA = a.claimDate?.toDate ? a.claimDate.toDate() : new Date(0);
            const dateB = b.claimDate?.toDate ? b.claimDate.toDate() : new Date(0);
            return dateA - dateB;
          });
          break;
      }
    },

    updatePagination() {
      this.totalPages = Math.ceil(this.filteredLogs.length / this.itemsPerPage);
      if (this.currentPage > this.totalPages) {
        this.currentPage = Math.max(1, this.totalPages);
      }
    },

    prevPage() {
      if (this.currentPage > 1) {
        this.currentPage--;
      }
    },

    nextPage() {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
      }
    },

    formatDate(dateValue) {
      try {
        let date;
        if (dateValue && typeof dateValue === 'object' && dateValue.toDate) {
          date = dateValue.toDate();
        } else if (dateValue) {
          date = new Date(dateValue);
        } else {
          return "No date available";
        }

        if (isNaN(date.getTime())) {
          return "Invalid date";
        }

        return new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }).format(date);
      } catch (error) {

        return "Date format error";
      }
    },

    toggleMobileMenu() {
      this.mobileMenuOpen = !this.mobileMenuOpen;
    },

    closeAccountMenuOutside(event) {
      if (!event.target.closest('.nav-account')) {
        this.accountMenuOpen = false;
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
      firebase.auth().signOut().catch(error => {

      });
    },

    checkMagicLinkSignIn() {
      if (firebase.auth().isSignInWithEmailLink(window.location.href)) {
        let email = window.localStorage.getItem('emailForSignIn');
        if (!email) {
          email = window.prompt('Please provide your email for confirmation');
        }
        if (email) {
          this.isLoading = true;
          firebase.auth().signInWithEmailLink(email, window.location.href)
            .then(() => {
              window.localStorage.removeItem('emailForSignIn');
              if (window.history && window.history.replaceState) {
                window.history.replaceState({}, document.title, window.location.pathname);
              }
            })
            .catch(() => {
              this.authError = "That sign-in link did not work. Request a fresh one below."; this.showLoginModal = true;
            })
            .finally(() => {
              this.isLoading = false;
            });
        }
      }
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
    }
  }
});

app.mount('#claimLogApp');