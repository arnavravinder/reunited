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

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const app = Vue.createApp({
  data() {
    return {
      user: null,
      authError: null,
      showLoginModal: false,
      isSigningUp: false,
      loginForm: {
        email: '',
        password: ''
      },
      magicLinkMode: false,
      magicLinkEmail: '',
      magicLinkSending: false,
      magicLinkSent: false,
      forgotPassword: false,
      resetEmail: '',
      passwordResetSending: false,
      passwordResetSent: false,
      showAppleComingSoon: false,
      
      isLoading: true,
      mobileMenuOpen: false,
      
      searchQuery: '',
      sortOption: 'date-desc',
      
      currentPage: 1,
      itemsPerPage: 10,
      totalPages: 1,
      
      logs: []
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
    });
    
    this.loadPublicLog();
    
    this.checkMagicLinkSignIn();
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
          console.error("Error loading public log:", error);
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
        console.error("Error formatting date:", error);
        return "Date format error";
      }
    },
    
    toggleMobileMenu() {
      this.mobileMenuOpen = !this.mobileMenuOpen;
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
    
    toggleMagicLinkMode() {
      this.magicLinkMode = !this.magicLinkMode;
      this.magicLinkSent = false;
      this.forgotPassword = false;
      this.showAppleComingSoon = false;
    },
    
    signOut() {
      firebase.auth().signOut().catch(error => {
        console.error("Error signing out:", error);
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
            alert("Error signing in. Please try again.");
          })
          .finally(() => {
            this.isLoading = false;
          });
        }
      }
    }
  }
}).mount('#claimLogApp');