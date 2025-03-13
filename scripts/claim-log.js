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
      selectedStatus: '',
      selectedCategory: '',
      sortOption: 'date-desc',
      
      currentPage: 1,
      itemsPerPage: 10,
      totalPages: 1,
      
      claims: []
    };
  },
  computed: {
    filteredClaims() {
      return this.claims.filter(claim => {
        const matchesSearch = !this.searchQuery || 
          claim.itemName.toLowerCase().includes(this.searchQuery.toLowerCase()) || 
          claim.location.toLowerCase().includes(this.searchQuery.toLowerCase());
        
        const matchesStatus = !this.selectedStatus || claim.status === this.selectedStatus;
        
        const matchesCategory = !this.selectedCategory || claim.category === this.selectedCategory;
        
        return matchesSearch && matchesStatus && matchesCategory;
      });
    },
    paginatedClaims() {
      const startIndex = (this.currentPage - 1) * this.itemsPerPage;
      const endIndex = startIndex + this.itemsPerPage;
      return this.filteredClaims.slice(startIndex, endIndex);
    }
  },
  watch: {
    filteredClaims() {
      this.updatePagination();
    },
    searchQuery() {
      this.currentPage = 1;
    },
    selectedStatus() {
      this.currentPage = 1;
    },
    selectedCategory() {
      this.currentPage = 1;
    },
    sortOption() {
      this.sortClaims();
    }
  },
  mounted() {
    console.log("Are you a developer/do you work in tech? I'm a 16 year old student, and open to exploring opportunities! Please reach out if you can: https://www.linkedin.com/in/arnav-ravinder");
    
    firebase.auth().onAuthStateChanged(user => {
      this.user = user;
    });
    
    this.loadPublicClaims();
    
    this.checkMagicLinkSignIn();
  },
  methods: {
    loadPublicClaims() {
      this.isLoading = true;
      
      db.collection('claims')
        .orderBy('claimDate', 'desc')
        .get()
        .then(snapshot => {
          const claimsData = [];
          const itemPromises = [];
          
          snapshot.forEach(doc => {
            const claim = { id: doc.id, ...doc.data() };
            
            const itemPromise = db.collection('items').doc(claim.itemId).get()
              .then(itemDoc => {
                if (itemDoc.exists) {
                  const itemData = itemDoc.data();
                  return {
                    ...claim,
                    itemName: itemData.name,
                    category: itemData.category,
                    location: itemData.location
                  };
                }
                return null;
              });
            
            itemPromises.push(itemPromise);
          });
          
          return Promise.all(itemPromises);
        })
        .then(claimsWithItems => {
          this.claims = claimsWithItems.filter(claim => claim !== null);
          this.sortClaims();
          this.updatePagination();
        })
        .catch(error => {
          console.error("Error loading claims:", error);
        })
        .finally(() => {
          this.isLoading = false;
        });
    },
    
    sortClaims() {
      switch (this.sortOption) {
        case 'date-desc':
          this.claims.sort((a, b) => {
            const dateA = a.claimDate && a.claimDate.toDate ? a.claimDate.toDate() : new Date(a.claimDate);
            const dateB = b.claimDate && b.claimDate.toDate ? b.claimDate.toDate() : new Date(b.claimDate);
            return dateB - dateA;
          });
          break;
        case 'date-asc':
          this.claims.sort((a, b) => {
            const dateA = a.claimDate && a.claimDate.toDate ? a.claimDate.toDate() : new Date(a.claimDate);
            const dateB = b.claimDate && b.claimDate.toDate ? b.claimDate.toDate() : new Date(b.claimDate);
            return dateA - dateB;
          });
          break;
        case 'status':
          this.claims.sort((a, b) => {
            const statusOrder = { pending: 0, approved: 1, collected: 2, rejected: 3 };
            return statusOrder[a.status] - statusOrder[b.status];
          });
          break;
      }
    },
    
    updatePagination() {
      this.totalPages = Math.ceil(this.filteredClaims.length / this.itemsPerPage);
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
    
    formatStatus(status) {
      switch (status) {
        case 'pending':
          return 'Pending';
        case 'approved':
          return 'Approved';
        case 'collected':
          return 'Collected';
        case 'rejected':
          return 'Rejected';
        default:
          return status.charAt(0).toUpperCase() + status.slice(1);
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