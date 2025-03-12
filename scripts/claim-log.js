// Claim Log JavaScript

const getEnvVar = (key, defaultValue = null) => {
    if (window.env && window.env[key]) {
      return window.env[key];
    }
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
    return defaultValue;
  };
  
  // Firebase config from environment variables
  const firebaseConfig = {
    apiKey: getEnvVar('FIREBASE_API_KEY'),
    authDomain: getEnvVar('FIREBASE_AUTH_DOMAIN'),
    databaseURL: getEnvVar('FIREBASE_DATABASE_URL'),
    projectId: getEnvVar('FIREBASE_PROJECT_ID'),
    storageBucket: getEnvVar('FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getEnvVar('FIREBASE_MESSAGING_SENDER_ID'),
    appId: getEnvVar('FIREBASE_APP_ID')
  };
  
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  
  // Initialize Firestore
  const db = firebase.firestore();
  
  // Vue App
  const app = Vue.createApp({
    data() {
      return {
        // Auth
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
        
        // UI States
        isLoading: true,
        mobileMenuOpen: false,
        
        // Claim Data
        currentClaim: null,
        claimHistory: [],
        selectedClaim: null
      };
    },
    mounted() {
      // Check authentication state
      firebase.auth().onAuthStateChanged(user => {
        this.user = user;
        
        if (user) {
          // Load claim data
          this.loadClaimData();
        } else {
          this.isLoading = false;
        }
      });
      
      // Check for magic link sign-in
      this.checkMagicLinkSignIn();
    },
    methods: {
      // Authentication Methods
      submitLoginForm() {
        this.authError = null;
        if (this.isSigningUp) {
          // Create user
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
          // Sign in existing user
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
      },
      
      signOut() {
        firebase.auth().signOut()
        .then(() => {
          window.location.href = 'index.html';
        })
        .catch(error => {
          console.error("Sign out error:", error);
        });
      },
      
      // UI Methods
      toggleMobileMenu() {
        this.mobileMenuOpen = !this.mobileMenuOpen;
      },
      
      // Claim Data Methods
      async loadClaimData() {
        try {
          if (!this.user) return;
          
          // Get claims for current user
          const claimsSnapshot = await db.collection('claims')
            .where('userId', '==', this.user.uid)
            .orderBy('claimDate', 'desc')
            .get();
          
          if (claimsSnapshot.empty) {
            this.currentClaim = null;
            this.claimHistory = [];
            this.isLoading = false;
            return;
          }
          
          // Process claims
          const claims = [];
          let activeClaim = null;
          
          for (const doc of claimsSnapshot.docs) {
            const claim = { id: doc.id, ...doc.data() };
            
            // Convert timestamp to date
            if (claim.claimDate) {
              claim.claimDate = claim.claimDate.toDate().toISOString();
            }
            if (claim.collectionDate) {
              claim.collectionDate = claim.collectionDate.toDate().toISOString();
            }
            
            // Get item details
            const itemDoc = await db.collection('items').doc(claim.itemId).get();
            if (itemDoc.exists) {
              claim.item = { id: itemDoc.id, ...itemDoc.data() };
            } else {
              claim.item = {
                id: claim.itemId,
                name: 'Unknown Item',
                category: 'Unknown',
                location: 'Unknown',
                dateFound: new Date().toISOString(),
                description: 'Item details not available',
                image: 'images/no-image.png'
              };
            }
            
            // Check if this is an active claim (pending and has claim code)
            if (claim.status === 'pending' && claim.claimCode && !activeClaim) {
              activeClaim = claim;
            } else {
              claims.push(claim);
            }
          }
          
          this.currentClaim = activeClaim;
          this.claimHistory = claims;
          this.isLoading = false;
        } catch (error) {
          console.error("Error loading claim data:", error);
          this.isLoading = false;
        }
      },
      
      // Claim Action Methods
      viewClaimDetails(claim) {
        this.selectedClaim = { ...claim };
      },
      
      disputeClaim(claimId) {
        window.location.href = 'index.html#contact';
      },
      
      async cancelClaim(claimId) {
        if (confirm('Are you sure you want to cancel this claim?')) {
          try {
            this.isLoading = true;
            
            // Get claim data
            const claimDoc = await db.collection('claims').doc(claimId).get();
            if (!claimDoc.exists) {
              throw new Error('Claim not found');
            }
            
            const claim = claimDoc.data();
            
            // Update claim status
            await db.collection('claims').doc(claimId).update({
              status: 'canceled',
              cancelDate: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Update item status if this claim is for the item
            const itemDoc = await db.collection('items').doc(claim.itemId).get();
            if (itemDoc.exists) {
              const item = itemDoc.data();
              if (item.claimId === claimId) {
                await db.collection('items').doc(claim.itemId).update({
                  claimed: false,
                  claimId: null
                });
              }
            }
            
            // Reload claim data
            await this.loadClaimData();
            
            // Close claim detail modal
            this.selectedClaim = null;
          } catch (error) {
            console.error("Error canceling claim:", error);
            alert("An error occurred while canceling your claim. Please try again.");
          } finally {
            this.isLoading = false;
          }
        }
      },
      
      // Formatting Methods
      formatDate(dateString) {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        }).format(date);
      },
      
      formatDateTime(dateString) {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric'
        }).format(date);
      }
    }
  }).mount('#claimLogApp');