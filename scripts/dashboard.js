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
const storage = firebase.storage();

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
      activeTab: 'notifications',
      
      userProfile: {
        displayName: '',
        email: '',
        phone: ''
      },
      userPreferences: {
        emailNotifications: true,
        matchAlerts: true,
        statusUpdates: true
      },
      isUpdating: false,
      
      passwordForm: {
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      },
      passwordError: null,
      passwordSuccess: null,
      showChangePasswordModal: false,
      
      showDeleteAccountModal: false,
      deleteConfirmation: '',
      isDeleting: false,
      
      notifications: [],
      lostItems: [],
      foundItems: [],
      claims: [],
      
      selectedItem: null,
      selectedItemType: null,
      
      showReportLostModal: false,
      showReportFoundModal: false,
      lostItemForm: {
        name: '',
        category: '',
        dateLost: this.formatDateForInput(new Date()),
        location: '',
        description: '',
        images: []
      },
      foundItemForm: {
        name: '',
        category: '',
        dateFound: this.formatDateForInput(new Date()),
        location: '',
        description: '',
        images: []
      },
      isSubmitting: false,
      
      categories: [
        'Electronics', 'Uniform', 'Water Bottle', 'Stationery', 
        'Books', 'Clothing', 'Accessories', 'Sports Equipment', 'Other'
      ],
      locations: [
        'Main Building', 'Cafeteria', 'Library', 'Gymnasium',
        'Lecture Hall', 'Parking Lot', 'Bus Stop', 'Park', 'Other'
      ],
      
      tabs: [
        { id: 'notifications', name: 'Notifications', icon: 'fas fa-bell' },
        { id: 'lost', name: 'Lost Items', icon: 'fas fa-search' },
        { id: 'found', name: 'Found Items', icon: 'fas fa-hand-holding' },
        { id: 'claims', name: 'My Claims', icon: 'fas fa-clipboard-check' },
        { id: 'settings', name: 'Settings', icon: 'fas fa-cog' }
      ],
      
      showClaimDetailsModal: false,
      selectedClaim: null
    };
  },
  mounted() {
    console.log("Are you a developer/do you work in tech? I'm a 16 year old student, and open to exploring opportunities! Please reach out if you can: https://www.linkedin.com/in/arnav-ravinder");
    
    firebase.auth().onAuthStateChanged(user => {
      this.user = user;
      
      if (user) {
        this.loadUserProfile();
        this.loadNotifications();
        this.loadLostItems();
        this.loadFoundItems();
        this.loadClaims();
      } else {
        this.isLoading = false;
      }
    });
    
    const hash = window.location.hash;
    if (hash) {
      const tabId = hash.substring(1);
      if (this.tabs.some(tab => tab.id === tabId)) {
        this.activeTab = tabId;
      }
    }
    
    this.checkMagicLinkSignIn();
  },
  methods: {
    formatDateForInput(date) {
      if (!date) return '';
      
      const d = new Date(date);
      if (isNaN(d.getTime())) return '';
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    },
    
    hasUnreadNotifications() {
      return this.notifications.some(notification => !notification.read);
    },
    
    getTabCount(tabId) {
      switch (tabId) {
        case 'notifications':
          return this.notifications.filter(notification => !notification.read).length;
        case 'lost':
          return this.lostItems.length;
        case 'found':
          return this.foundItems.length;
        case 'claims':
          return this.claims.length;
        default:
          return 0;
      }
    },
    
    getNotificationIcon(type) {
      switch (type) {
        case 'claim':
          return 'fas fa-clipboard-check';
        case 'match':
          return 'fas fa-search';
        case 'status':
          return 'fas fa-info-circle';
        case 'system':
          return 'fas fa-cog';
        default:
          return 'fas fa-bell';
      }
    },
    
    loadUserProfile() {
      if (!this.user) return;
      
      db.collection('users').doc(this.user.uid).get()
        .then(doc => {
          if (doc.exists) {
            const data = doc.data();
            this.userProfile = {
              displayName: data.displayName || this.user.displayName || '',
              email: this.user.email,
              phone: data.phone || ''
            };
            
            if (data.preferences) {
              this.userPreferences = {
                emailNotifications: data.preferences.emailNotifications !== false,
                matchAlerts: data.preferences.matchAlerts !== false,
                statusUpdates: data.preferences.statusUpdates !== false
              };
            }
          } else {
            db.collection('users').doc(this.user.uid).set({
              displayName: this.user.displayName || '',
              email: this.user.email,
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              preferences: this.userPreferences
            });
          }
        })
        .catch(error => {
          console.error("Error loading user profile:", error);
        })
        .finally(() => {
          this.isLoading = false;
        });
    },
    
    loadNotifications() {
      if (!this.user) return;
      
      db.collection('notifications')
        .where('userId', '==', this.user.uid)
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get()
        .then(snapshot => {
          this.notifications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        })
        .catch(error => {
          console.error("Error loading notifications:", error);
        });
    },
    
    loadLostItems() {
      if (!this.user) return;
      
      db.collection('lostItems')
        .where('userId', '==', this.user.uid)
        .orderBy('dateLost', 'desc')
        .get()
        .then(snapshot => {
          this.lostItems = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        })
        .catch(error => {
          console.error("Error loading lost items:", error);
        });
    },
    
    loadFoundItems() {
      if (!this.user) return;
      
      db.collection('items')
        .where('reportedBy', '==', this.user.uid)
        .orderBy('dateFound', 'desc')
        .get()
        .then(snapshot => {
          this.foundItems = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        })
        .catch(error => {
          console.error("Error loading found items:", error);
        });
    },
    
    loadClaims() {
      if (!this.user) return;
      
      db.collection('claims')
        .where('userId', '==', this.user.uid)
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
                  return {
                    ...claim,
                    item: { id: itemDoc.id, ...itemDoc.data() }
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
        })
        .catch(error => {
          console.error("Error loading claims:", error);
        });
    },
    
    markAsRead(notificationId) {
      db.collection('notifications').doc(notificationId).update({
        read: true
      })
      .then(() => {
        const index = this.notifications.findIndex(n => n.id === notificationId);
        if (index !== -1) {
          this.notifications[index].read = true;
        }
      })
      .catch(error => {
        console.error("Error marking notification as read:", error);
      });
    },
    
    markAllAsRead() {
      const batch = db.batch();
      
      this.notifications.forEach(notification => {
        if (!notification.read) {
          const notificationRef = db.collection('notifications').doc(notification.id);
          batch.update(notificationRef, { read: true });
        }
      });
      
      batch.commit()
        .then(() => {
          this.notifications.forEach(notification => {
            notification.read = true;
          });
        })
        .catch(error => {
          console.error("Error marking all notifications as read:", error);
        });
    },
    
    handleNotificationAction(notification) {
      this.markAsRead(notification.id);
      
      switch (notification.type) {
        case 'claim':
          this.activeTab = 'claims';
          if (notification.claimId) {
            const claim = this.claims.find(c => c.id === notification.claimId);
            if (claim) {
              this.viewClaimDetails(claim);
            }
          }
          break;
        case 'match':
          this.activeTab = 'lost';
          break;
        case 'status':
          if (notification.itemType === 'lost') {
            this.activeTab = 'lost';
          } else {
            this.activeTab = 'found';
          }
          break;
        default:
          break;
      }
    },
    
    updateProfile() {
      if (!this.user) return;
      
      this.isUpdating = true;
      
      if (this.userProfile.displayName !== this.user.displayName) {
        this.user.updateProfile({
          displayName: this.userProfile.displayName
        });
      }
      
      db.collection('users').doc(this.user.uid).update({
        displayName: this.userProfile.displayName,
        phone: this.userProfile.phone
      })
      .then(() => {
        alert("Profile updated successfully!");
      })
      .catch(error => {
        console.error("Error updating profile:", error);
        alert("Error updating profile. Please try again.");
      })
      .finally(() => {
        this.isUpdating = false;
      });
    },
    
    updatePreferences() {
      if (!this.user) return;
      
      this.isUpdating = true;
      
      db.collection('users').doc(this.user.uid).update({
        'preferences.emailNotifications': this.userPreferences.emailNotifications,
        'preferences.matchAlerts': this.userPreferences.matchAlerts,
        'preferences.statusUpdates': this.userPreferences.statusUpdates
      })
      .then(() => {
        alert("Preferences saved successfully!");
      })
      .catch(error => {
        console.error("Error updating preferences:", error);
        alert("Error saving preferences. Please try again.");
      })
      .finally(() => {
        this.isUpdating = false;
      });
    },
    
    changePassword() {
      this.passwordError = null;
      this.passwordSuccess = null;
      
      if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) {
        this.passwordError = "New password and confirmation do not match.";
        return;
      }
      
      this.isUpdating = true;
      
      const credential = firebase.auth.EmailAuthProvider.credential(
        this.user.email, 
        this.passwordForm.currentPassword
      );
      
      this.user.reauthenticateWithCredential(credential)
        .then(() => {
          return this.user.updatePassword(this.passwordForm.newPassword);
        })
        .then(() => {
          this.passwordSuccess = "Password changed successfully!";
          this.passwordForm = {
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
          };
          
          setTimeout(() => {
            this.showChangePasswordModal = false;
            this.passwordSuccess = null;
          }, 2000);
        })
        .catch(error => {
          console.error("Error changing password:", error);
          if (error.code === 'auth/wrong-password') {
            this.passwordError = "Current password is incorrect.";
          } else {
            this.passwordError = error.message;
          }
        })
        .finally(() => {
          this.isUpdating = false;
        });
    },
    
    deleteAccount() {
      if (this.deleteConfirmation !== 'DELETE') {
        return;
      }
      
      this.isDeleting = true;
      
      const batch = db.batch();
      
      const userRef = db.collection('users').doc(this.user.uid);
      batch.delete(userRef);
      
      Promise.all([
        this.deleteLostItems(batch),
        this.deleteFoundItems(batch),
        this.deleteClaims(batch),
        this.deleteNotifications(batch)
      ])
      .then(() => {
        return batch.commit();
      })
      .then(() => {
        return this.user.delete();
      })
      .then(() => {
        window.location.href = "index.html";
      })
      .catch(error => {
        console.error("Error deleting account:", error);
        alert("Error deleting account. You may need to sign in again before deleting your account.");
        this.isDeleting = false;
        this.showDeleteAccountModal = false;
      });
    },
    
    deleteLostItems(batch) {
      return db.collection('lostItems')
        .where('userId', '==', this.user.uid)
        .get()
        .then(snapshot => {
          snapshot.forEach(doc => {
            batch.delete(doc.ref);
          });
        });
    },
    
    deleteFoundItems(batch) {
      return db.collection('items')
        .where('reportedBy', '==', this.user.uid)
        .get()
        .then(snapshot => {
          snapshot.forEach(doc => {
            batch.delete(doc.ref);
          });
        });
    },
    
    deleteClaims(batch) {
      return db.collection('claims')
        .where('userId', '==', this.user.uid)
        .get()
        .then(snapshot => {
          snapshot.forEach(doc => {
            batch.delete(doc.ref);
          });
        });
    },
    
    deleteNotifications(batch) {
      return db.collection('notifications')
        .where('userId', '==', this.user.uid)
        .get()
        .then(snapshot => {
          snapshot.forEach(doc => {
            batch.delete(doc.ref);
          });
        });
    },
    
    viewItemDetails(item, type) {
      this.selectedItem = { ...item };
      this.selectedItemType = type;
    },
    
    viewClaimDetails(claim) {
      this.selectedClaim = claim;
      this.showClaimDetailsModal = true;
    },
    
    editItem(item, type) {
      if (type === 'lost') {
        this.lostItemForm = {
          id: item.id,
          name: item.name,
          category: item.category,
          dateLost: this.formatDateForInput(item.dateLost),
          location: item.location,
          description: item.description,
          images: []
        };
        this.showReportLostModal = true;
      } else {
        this.foundItemForm = {
          id: item.id,
          name: item.name,
          category: item.category,
          dateFound: this.formatDateForInput(item.dateFound),
          location: item.location,
          description: item.description,
          images: []
        };
        this.showReportFoundModal = true;
      }
      
      this.selectedItem = null;
    },
    
    deleteItem(itemId, type) {
      if (!confirm("Are you sure you want to delete this item?")) {
        return;
      }
      
      const collection = type === 'lost' ? 'lostItems' : 'items';
      
      db.collection(collection).doc(itemId).delete()
        .then(() => {
          if (type === 'lost') {
            this.lostItems = this.lostItems.filter(item => item.id !== itemId);
          } else {
            this.foundItems = this.foundItems.filter(item => item.id !== itemId);
          }
          
          this.selectedItem = null;
          alert("Item deleted successfully!");
        })
        .catch(error => {
          console.error("Error deleting item:", error);
          alert("Error deleting item. Please try again.");
        });
    },
    
    handleImageUpload(event) {
      const files = event.target.files;
      if (!files || files.length === 0) return;
      
      Array.from(files).forEach(file => {
        if (!file.type.match('image.*')) {
          alert("Please upload images only.");
          return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
          this.lostItemForm.images.push({
            file: file,
            preview: e.target.result
          });
        };
        reader.readAsDataURL(file);
      });
    },
    
    handleFoundImageUpload(event) {
      const files = event.target.files;
      if (!files || files.length === 0) return;
      
      Array.from(files).forEach(file => {
        if (!file.type.match('image.*')) {
          alert("Please upload images only.");
          return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
          this.foundItemForm.images.push({
            file: file,
            preview: e.target.result
          });
        };
        reader.readAsDataURL(file);
      });
    },
    
    removeImage(index) {
      this.lostItemForm.images.splice(index, 1);
    },
    
    removeFoundImage(index) {
      this.foundItemForm.images.splice(index, 1);
    },
    
    async submitLostItemReport() {
      if (!this.user) return;
      
      this.isSubmitting = true;
      
      try {
        const searchTerms = this.generateSearchTerms(
          this.lostItemForm.name + ' ' + 
          this.lostItemForm.category + ' ' + 
          this.lostItemForm.description
        );
        
        const itemData = {
          name: this.lostItemForm.name,
          category: this.lostItemForm.category,
          dateLost: new Date(this.lostItemForm.dateLost),
          location: this.lostItemForm.location,
          description: this.lostItemForm.description,
          userId: this.user.uid,
          userName: this.user.displayName || this.user.email,
          status: 'active',
          searchTerms: searchTerms,
          hasImages: this.lostItemForm.images.length > 0,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        
        let docRef;
        
        if (this.lostItemForm.id) {
          docRef = db.collection('lostItems').doc(this.lostItemForm.id);
          await docRef.update(itemData);
        } else {
          itemData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
          docRef = await db.collection('lostItems').add(itemData);
        }
        
        if (this.lostItemForm.images.length > 0) {
          await this.uploadImages(docRef.id, this.lostItemForm.images, 'lost');
        }
        
        await this.loadLostItems();
        
        this.lostItemForm = {
          name: '',
          category: '',
          dateLost: this.formatDateForInput(new Date()),
          location: '',
          description: '',
          images: []
        };
        
        this.showReportLostModal = false;
        
        alert(this.lostItemForm.id ? "Lost item updated successfully!" : "Lost item reported successfully! We'll notify you if we find a match.");
      } catch (error) {
        console.error("Error reporting lost item:", error);
        alert("Error reporting lost item. Please try again.");
      } finally {
        this.isSubmitting = false;
      }
    },
    
    async submitFoundItemReport() {
      if (!this.user) return;
      
      this.isSubmitting = true;
      
      try {
        const searchTerms = this.generateSearchTerms(
          this.foundItemForm.name + ' ' + 
          this.foundItemForm.category + ' ' + 
          this.foundItemForm.description
        );
        
        const itemData = {
          name: this.foundItemForm.name,
          category: this.foundItemForm.category,
          dateFound: new Date(this.foundItemForm.dateFound),
          location: this.foundItemForm.location,
          description: this.foundItemForm.description,
          reportedBy: this.user.uid,
          reportedByName: this.user.displayName || this.user.email,
          status: 'available',
          claimed: false,
          searchTerms: searchTerms,
          hasAdditionalImages: this.foundItemForm.images.length > 0,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        
        let docRef;
        
        if (this.foundItemForm.id) {
          docRef = db.collection('items').doc(this.foundItemForm.id);
          await docRef.update(itemData);
        } else {
          itemData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
          docRef = await db.collection('items').add(itemData);
        }
        
        if (this.foundItemForm.images.length > 0) {
          await this.uploadImages(docRef.id, this.foundItemForm.images, 'found');
        }
        
        await this.loadFoundItems();
        
        this.foundItemForm = {
          name: '',
          category: '',
          dateFound: this.formatDateForInput(new Date()),
          location: '',
          description: '',
          images: []
        };
        
        this.showReportFoundModal = false;
        
        alert(this.foundItemForm.id ? "Found item updated successfully!" : "Found item reported successfully! It will now appear in the search results.");
      } catch (error) {
        console.error("Error reporting found item:", error);
        alert("Error reporting found item. Please try again.");
      } finally {
        this.isSubmitting = false;
      }
    },
    
    async uploadImages(itemId, images, type) {
      const promises = [];
      const collection = type === 'lost' ? 'lostItems' : 'items';
      
      if (images.length > 0) {
        const mainImageRef = storage.ref(`${collection}/${itemId}/main.jpg`);
        promises.push(mainImageRef.put(images[0].file));
        
        for (let i = 1; i < images.length; i++) {
          const imageRef = storage.ref(`${collection}/${itemId}/images/${i}.jpg`);
          promises.push(imageRef.put(images[i].file));
        }
      }
      
      await Promise.all(promises);
      
      if (images.length > 0) {
        const mainImageUrl = await storage.ref(`${collection}/${itemId}/main.jpg`).getDownloadURL();
        
        await db.collection(collection).doc(itemId).update({
          image: mainImageUrl
        });
      }
    },
    
    generateSearchTerms(text) {
      return text.toLowerCase()
        .split(/\s+/)
        .filter(term => term.length > 2)
        .slice(0, 20);
    },
    
    getClaimStatusClass(status) {
      switch (status) {
        case 'pending':
          return 'pending';
        case 'approved':
          return 'approved';
        case 'collected':
          return 'collected';
        case 'rejected':
          return 'rejected';
        default:
          return '';
      }
    },
    
    getFormattedClaimStatus(status) {
      switch (status) {
        case 'pending':
          return 'Pending Review';
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
    
    truncateDescription(text, maxLength = 100) {
      if (!text || text.length <= maxLength) return text || '';
      return text.substring(0, maxLength) + '...';
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
}).mount('#dashboardApp');