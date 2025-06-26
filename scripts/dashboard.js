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
      phoneValid: false,
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
      deleteConfirmation: '',
      isDeleting: false,
      notifications: [],
      lostItems: [],
      foundItems: [],
      claims: [],
      selectedItem: null,
      selectedItemType: null,
      lostItemForm: this.getInitialLostItemForm(),
      foundItemForm: this.getInitialFoundItemForm(),
      isSubmitting: false,
      isEnhancingDescription: false,
      aiError: null,
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
      selectedClaim: null,
      flatpickrInstances: {},
    };
  },
  mounted() {
    firebase.auth().onAuthStateChanged(user => {
      this.user = user;

      if (user) {
        this.resetDashboardData();
        Promise.all([
            this.loadUserProfile(),
            this.loadNotifications(),
            this.loadLostItems(),
            this.loadFoundItems(),
            this.loadClaims()
        ]).finally(() => {
            this.isLoading = false;
            this.hideInitialLoader();
            this.$nextTick(() => {
                this.initializeFlatpickr();
            });
        });
      } else {
        this.resetDashboardData();
        Object.values(this.flatpickrInstances).forEach(fp => fp.destroy());
        this.flatpickrInstances = {};
        this.isLoading = false;
        this.hideInitialLoader();
      }
    });

    const hash = window.location.hash;
    if (hash) {
      const tabId = hash.substring(1);
      if (this.tabs.some(tab => tab.id === tabId)) {
        this.activeTab = tabId;
      }
    } else {
        this.activeTab = 'notifications';
    }
    this.checkMagicLinkSignIn();
  },
  methods: {
    hideInitialLoader() {
      const loader = document.getElementById('appLoading');
      if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => {
          loader.style.display = 'none';
        }, 300);
      }
    },
    onPhoneValidate(validation) {
      this.phoneValid = validation.valid;
    },
    initializeFlatpickr() {
        const commonConfig = {
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "F j, Y",
            allowInput: true,
        };

        const lostDateElem = document.getElementById('lostDatePopupFlatpickr');
        if (lostDateElem && !this.flatpickrInstances.lostDate) {
            this.flatpickrInstances.lostDate = flatpickr(lostDateElem, {
                ...commonConfig,
                defaultDate: this.lostItemForm.dateLost || "today",
                onChange: (selectedDates, dateStr) => {
                    this.lostItemForm.dateLost = dateStr;
                }
            });
        }

        const foundDateElem = document.getElementById('foundDatePopupFlatpickr');
        if (foundDateElem && !this.flatpickrInstances.foundDate) {
            this.flatpickrInstances.foundDate = flatpickr(foundDateElem, {
                ...commonConfig,
                defaultDate: this.foundItemForm.dateFound || "today",
                onChange: (selectedDates, dateStr) => {
                    this.foundItemForm.dateFound = dateStr;
                }
            });
        }
    },
    destroyFlatpickrInstance(key) {
        if (this.flatpickrInstances[key]) {
            this.flatpickrInstances[key].destroy();
            delete this.flatpickrInstances[key];
        }
    },
    async enhanceDescription(type) {
        this.isEnhancingDescription = true;
        this.aiError = null;
        
        const form = type === 'lost' ? this.lostItemForm : this.foundItemForm;
        const currentDescription = form.description;
        
        if (!currentDescription || currentDescription.trim().length < 10) {
            this.aiError = "Please write at least a basic description before enhancing with AI.";
            this.isEnhancingDescription = false;
            return;
        }

        try {
            const prompt = type === 'lost' 
                ? `Enhance this lost item description to be more detailed and helpful for finding the item. Keep it concise but comprehensive. Original description: "${currentDescription}"`
                : `Enhance this found item description to be more detailed and helpful for the owner to identify their item. Keep it concise but comprehensive. Original description: "${currentDescription}"`;

            const response = await fetch('https://ai.hackclub.com/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 200,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                throw new Error(`AI service error: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.choices && data.choices[0] && data.choices[0].message) {
                const enhancedDescription = data.choices[0].message.content.trim();
                form.description = enhancedDescription;
            } else {
                throw new Error('Unexpected response format from AI service');
            }
        } catch (error) {
            console.error('Error enhancing description:', error);
            this.aiError = `Failed to enhance description: ${error.message}. Please try again.`;
        } finally {
            this.isEnhancingDescription = false;
        }
    },
    showGenericMessagePopup(message) {
      const popup = document.getElementById('reunited-generic-message-popup');
      const popupMessage = document.getElementById('reunited-generic-popup-message');
      if (popup && popupMessage) {
        popupMessage.textContent = message;
        popup.style.display = 'flex';
      } else {
        console.error('Generic message popup elements not found');
      }
    },
    hideGenericMessagePopup() {
      const popup = document.getElementById('reunited-generic-message-popup');
      if (popup) {
        popup.style.display = 'none';
      }
    },
    openReportLostPopup() {
      if (!this.lostItemForm.id) {
          this.lostItemForm = this.getInitialLostItemForm();
      }
      this.aiError = null;
      this.$nextTick(() => {
          if (this.flatpickrInstances.lostDate) {
              this.flatpickrInstances.lostDate.setDate(this.lostItemForm.dateLost || "today", true);
          } else {
              this.initializeFlatpickr();
              if (this.flatpickrInstances.lostDate) {
                 this.flatpickrInstances.lostDate.setDate(this.lostItemForm.dateLost || "today", true);
              }
          }
      });
      const popup = document.getElementById('reportLostItemPopup');
      if (popup) popup.style.display = 'flex';
    },
    closeReportLostPopup() {
      const popup = document.getElementById('reportLostItemPopup');
      if (popup) popup.style.display = 'none';
      this.lostItemForm = this.getInitialLostItemForm();
      this.aiError = null;
    },
    openReportFoundPopup() {
      if (!this.foundItemForm.id) {
          this.foundItemForm = this.getInitialFoundItemForm();
      }
      this.aiError = null;
       this.$nextTick(() => {
          if (this.flatpickrInstances.foundDate) {
              this.flatpickrInstances.foundDate.setDate(this.foundItemForm.dateFound || "today", true);
          } else {
              this.initializeFlatpickr();
              if(this.flatpickrInstances.foundDate) {
                 this.flatpickrInstances.foundDate.setDate(this.foundItemForm.dateFound || "today", true);
              }
          }
      });
      const popup = document.getElementById('reportFoundItemPopup');
      if (popup) popup.style.display = 'flex';
    },
    closeReportFoundPopup() {
      const popup = document.getElementById('reportFoundItemPopup');
      if (popup) popup.style.display = 'none';
      this.foundItemForm = this.getInitialFoundItemForm();
      this.aiError = null;
    },
    openChangePasswordPopup() {
      this.passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
      this.passwordError = null;
      this.passwordSuccess = null;
      const popup = document.getElementById('changePasswordPopup');
      if (popup) popup.style.display = 'flex';
    },
    closeChangePasswordPopup() {
      const popup = document.getElementById('changePasswordPopup');
      if (popup) popup.style.display = 'none';
    },
    openDeleteAccountPopup() {
      this.deleteConfirmation = '';
      this.authError = null;
      const popup = document.getElementById('deleteAccountPopup');
      if (popup) popup.style.display = 'flex';
    },
    closeDeleteAccountPopup() {
      const popup = document.getElementById('deleteAccountPopup');
      if (popup) popup.style.display = 'none';
    },
    
    openClaimDetailsPopup(claim) {
      if (claim && claim.item) {
          this.selectedClaim = claim;
      } else if (claim) {
           this.selectedClaim = { ...claim, item: { name: 'Item details unavailable', category: '', dateFound: '', location: '', description: '' } };
      } else {
          console.error("Attempted to view details for an invalid claim object.");
          return;
      }
      const popup = document.getElementById('claimDetailsPopup');
      if (popup) popup.style.display = 'flex';
    },
    closeClaimDetailsPopup() {
        const popup = document.getElementById('claimDetailsPopup');
        if (popup) popup.style.display = 'none';
        this.selectedClaim = null;
    },
    openItemDetailsPopup(item, type) {
      this.selectedItem = { ...item };
      this.selectedItemType = type;
      const popup = document.getElementById('itemDetailsPopup');
      if (popup) popup.style.display = 'flex';
    },
    closeItemDetailsPopup() {
        const popup = document.getElementById('itemDetailsPopup');
        if (popup) popup.style.display = 'none';
        this.selectedItem = null;
        this.selectedItemType = null;
    },
    getInitialLostItemForm() {
      return {
        id: null,
        name: '',
        category: '',
        dateLost: this.formatDateForInput(new Date()),
        location: '',
        description: '',
        images: []
      };
    },
    getInitialFoundItemForm() {
       return {
        id: null,
        name: '',
        category: '',
        dateFound: this.formatDateForInput(new Date()),
        location: '',
        description: '',
        images: []
      };
    },
    resetDashboardData() {
        this.notifications = [];
        this.lostItems = [];
        this.foundItems = [];
        this.claims = [];
        this.userProfile = { displayName: '', email: '', phone: '' };
        this.userPreferences = { emailNotifications: true, matchAlerts: true, statusUpdates: true };
        this.selectedItem = null;
        this.selectedClaim = null;
        this.lostItemForm = this.getInitialLostItemForm();
        this.foundItemForm = this.getInitialFoundItemForm();
        this.passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
        this.passwordError = null;
        this.passwordSuccess = null;
        this.deleteConfirmation = '';
        this.authError = null;
        this.loginForm = { email: '', password: ''};
        this.isSigningUp = false;
        this.magicLinkMode = false;
        this.forgotPassword = false;
        this.aiError = null;
    },
    formatDateForInput(date) {
      if (!date) return '';
      let d;
      if (date instanceof Date) {
        d = date;
      } else if (date && typeof date === 'object' && date.toDate) {
        d = date.toDate();
      } else {
        d = new Date(date);
      }
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
        case 'claim_update':
        case 'claim':
          return 'fas fa-clipboard-check';
        case 'match_found':
        case 'match':
          return 'fas fa-link';
        case 'item_status':
        case 'status':
          return 'fas fa-info-circle';
        case 'system_message':
        case 'system':
          return 'fas fa-cog';
        default:
          return 'fas fa-bell';
      }
    },
    loadUserProfile() {
      if (!this.user) return Promise.resolve();
      return db.collection('users').doc(this.user.uid).get()
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
            } else {
               this.userPreferences = { emailNotifications: true, matchAlerts: true, statusUpdates: true };
            }
          } else {
            this.userProfile = {
              displayName: this.user.displayName || '',
              email: this.user.email,
              phone: ''
            };
            this.userPreferences = { emailNotifications: true, matchAlerts: true, statusUpdates: true };
            db.collection('users').doc(this.user.uid).set({
              displayName: this.userProfile.displayName,
              email: this.userProfile.email,
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              preferences: this.userPreferences
            }).catch(error => console.error("Error creating user profile doc:", error));
          }
        })
        .catch(error => {
          console.error("Error loading user profile:", error);
        });
    },
    loadNotifications() {
      if (!this.user) return Promise.resolve();
      return db.collection('notifications')
        .where('userId', '==', this.user.uid)
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get()
        .then(snapshot => {
          this.notifications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp
          }));
        })
        .catch(error => {
          console.error("Error loading notifications:", error);
        });
    },
    loadLostItems() {
      if (!this.user) return Promise.resolve();
      return db.collection('lostItems')
        .where('userId', '==', this.user.uid)
        .orderBy('dateLost', 'desc')
        .get()
        .then(snapshot => {
          this.lostItems = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            dateLost: doc.data().dateLost
          }));
        })
        .catch(error => {
          console.error("Error loading lost items:", error);
        });
    },
    loadFoundItems() {
      if (!this.user) return Promise.resolve();
      return db.collection('items')
        .where('reportedBy', '==', this.user.uid)
        .orderBy('dateFound', 'desc')
        .get()
        .then(snapshot => {
          this.foundItems = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            dateFound: doc.data().dateFound
          }));
        })
        .catch(error => {
          console.error("Error loading found items:", error);
        });
    },
    loadClaims() {
      if (!this.user) return Promise.resolve();
      return db.collection('claims')
        .where('userId', '==', this.user.uid)
        .orderBy('claimDate', 'desc')
        .get()
        .then(async snapshot => {
          const claimsData = [];
          const itemPromises = [];
          snapshot.forEach(doc => {
            const claim = {
                id: doc.id,
                ...doc.data(),
                claimDate: doc.data().claimDate
            };
            if (claim.itemId) {
                 const itemPromise = db.collection('items').doc(claim.itemId).get()
                  .then(itemDoc => {
                    if (itemDoc.exists) {
                      return {
                        ...claim,
                        item: { id: itemDoc.id, ...itemDoc.data() }
                      };
                    } else {
                      console.warn(`Item with ID ${claim.itemId} not found for claim ${claim.id}`);
                      return { ...claim, item: null };
                    }
                  }).catch(error => {
                      console.error(`Error fetching item ${claim.itemId} for claim ${claim.id}:`, error);
                      return { ...claim, item: null };
                  });
                itemPromises.push(itemPromise);
            } else {
                console.warn(`Claim ${claim.id} is missing itemId.`);
                claimsData.push({ ...claim, item: null });
            }
          });
          const claimsWithItems = await Promise.all(itemPromises);
          this.claims = [...claimsData, ...claimsWithItems.filter(c => c !== null)];
        })
        .catch(error => {
          console.error("Error loading claims:", error);
        });
    },
    markAsRead(notificationId) {
      const notificationRef = db.collection('notifications').doc(notificationId);
      notificationRef.update({
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
        this.showGenericMessagePopup("Failed to mark notification as read. Please try again.");
      });
    },
    markAllAsRead() {
      const batch = db.batch();
      const unreadNotifications = this.notifications.filter(n => !n.read);
      if (unreadNotifications.length === 0) return;
      unreadNotifications.forEach(notification => {
        const notificationRef = db.collection('notifications').doc(notification.id);
        batch.update(notificationRef, { read: true });
      });
      batch.commit()
        .then(() => {
          this.notifications.forEach(notification => {
            if (!notification.read) {
              notification.read = true;
            }
          });
        })
        .catch(error => {
          console.error("Error marking all notifications as read:", error);
          this.showGenericMessagePopup("Failed to mark all notifications as read. Please try again.");
        });
    },
    handleNotificationAction(notification) {
      if (!notification.read) {
          this.markAsRead(notification.id);
      }
      switch (notification.type) {
        case 'claim_update':
        case 'claim':
          this.activeTab = 'claims';
          if (notification.claimId) {
            const claim = this.claims.find(c => c.id === notification.claimId);
            if (claim) {
              this.openClaimDetailsPopup(claim);
            } else {
                console.warn(`Claim ${notification.claimId} not found in loaded claims.`);
            }
          }
          break;
        case 'match_found':
        case 'match':
          this.activeTab = 'lost';
          break;
        case 'item_status':
        case 'status':
          if (notification.itemType === 'lost' && notification.itemId) {
            this.activeTab = 'lost';
            const item = this.lostItems.find(i => i.id === notification.itemId);
            if(item) this.openItemDetailsPopup(item, 'lost');
          } else if (notification.itemType === 'found' && notification.itemId) {
            this.activeTab = 'found';
            const item = this.foundItems.find(i => i.id === notification.itemId);
            if(item) this.openItemDetailsPopup(item, 'found');
          }
          break;
        case 'system_message':
        case 'system':
          break;
        default:
          break;
      }
    },
    updateProfile() {
      if (!this.user) return;
      this.isUpdating = true;

      if (this.userProfile.phone && !this.phoneValid) {
           this.showGenericMessagePopup("Phone number is invalid. Please correct it or leave it blank.");
           this.isUpdating = false;
           return;
      }

      const updates = [];
      if (this.userProfile.displayName !== this.user.displayName) {
        updates.push(
            this.user.updateProfile({
                displayName: this.userProfile.displayName
            }).catch(error => {
                console.error("Error updating auth profile:", error);
                throw new Error("Auth profile update failed");
            })
        );
      }
      updates.push(
        db.collection('users').doc(this.user.uid).update({
            displayName: this.userProfile.displayName,
            phone: this.userProfile.phone || ''
        }).catch(error => {
            console.error("Error updating firestore profile:", error);
            throw new Error("Firestore profile update failed");
        })
      );
      Promise.all(updates)
        .then(() => {
            this.showGenericMessagePopup("Profile updated successfully!");
        })
        .catch(error => {
            console.error("Error updating profile:", error);
            this.showGenericMessagePopup(`Error updating profile: ${error.message}. Please try again.`);
        })
        .finally(() => {
            this.isUpdating = false;
        });
    },
    updatePreferences() {
      if (!this.user) return;
      this.isUpdating = true;
      db.collection('users').doc(this.user.uid).set({
        preferences: {
          emailNotifications: this.userPreferences.emailNotifications,
          matchAlerts: this.userPreferences.matchAlerts,
          statusUpdates: this.userPreferences.statusUpdates
        }
      }, { merge: true })
      .then(() => {
        this.showGenericMessagePopup("Preferences saved successfully!");
      })
      .catch(error => {
        console.error("Error updating preferences:", error);
        this.showGenericMessagePopup(`Error saving preferences. Please try again.`);
      })
      .finally(() => {
        this.isUpdating = false;
      });
    },
    changePassword() {
      this.passwordError = null;
      this.passwordSuccess = null;
      if (!this.passwordForm.currentPassword || !this.passwordForm.newPassword || !this.passwordForm.confirmPassword) {
          this.passwordError = "Please fill in all password fields.";
          return;
      }
      if (this.passwordForm.newPassword.length < 6) {
          this.passwordError = "New password must be at least 6 characters long.";
          return;
      }
      if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) {
        this.passwordError = "New password and confirmation do not match.";
        return;
      }
      if (this.passwordForm.newPassword === this.passwordForm.currentPassword) {
        this.passwordError = "New password cannot be the same as the current password.";
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
          this.passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
          setTimeout(() => {
            this.closeChangePasswordPopup();
            this.passwordSuccess = null;
            this.passwordError = null;
          }, 2000);
        })
        .catch(error => {
          console.error("Error changing password:", error);
          if (error.code === 'auth/wrong-password') {
            this.passwordError = "Current password is incorrect.";
          } else if (error.code === 'auth/weak-password') {
              this.passwordError = "The new password is too weak.";
          } else {
            this.passwordError = `An error occurred: ${error.message}`;
          }
        })
        .finally(() => {
          this.isUpdating = false;
        });
    },
    async deleteAccount() {
      if (this.deleteConfirmation !== 'DELETE') {
        this.authError = "Please type DELETE exactly to confirm account deletion.";
        return;
      }
      this.authError = null;
      this.isDeleting = true;
      try {
          const batch = db.batch();
          const userRef = db.collection('users').doc(this.user.uid);
          batch.delete(userRef);
          const results = await Promise.allSettled([
              this.deleteCollectionForUser(batch, 'lostItems', 'userId'),
              this.deleteCollectionForUser(batch, 'items', 'reportedBy'),
              this.deleteCollectionForUser(batch, 'claims', 'userId'),
              this.deleteCollectionForUser(batch, 'notifications', 'userId')
          ]);
          results.forEach(result => {
              if (result.status === 'rejected') {
                  console.error("Error querying/batching deletions:", result.reason);
              }
          });
          await batch.commit();
          await this.user.delete();
          this.closeDeleteAccountPopup();
          window.location.href = "index.html";
      } catch (error) {
          console.error("Error deleting account:", error);
          this.authError = `Error deleting account: ${error.message}. You might need to log in again or contact support if the issue persists.`;
          this.isDeleting = false;
      }
    },
    async deleteCollectionForUser(batch, collectionName, userField) {
        const snapshot = await db.collection(collectionName)
                                 .where(userField, '==', this.user.uid)
                                 .limit(500)
                                 .get();
        if (!snapshot.empty) {
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
        }
    },
    editItem(item, type) {
        this.closeItemDetailsPopup();
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
            this.openReportLostPopup();
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
            this.openReportFoundPopup();
        }
    },
    deleteItem(itemId, type) {
      this.closeItemDetailsPopup();
      if (!confirm("Are you sure you want to delete this item? This action cannot be undone.")) {
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
          this.showGenericMessagePopup("Item deleted successfully!");
        })
        .catch(error => {
          console.error("Error deleting item:", error);
          this.showGenericMessagePopup("Error deleting item. Please try again.");
        });
    },
    handleImageUpload(event) {
      const files = event.target.files;
      if (!files || files.length === 0) return;
      const maxImages = 5;
      if (this.lostItemForm.images.length + files.length > maxImages) {
          this.showGenericMessagePopup(`You can upload a maximum of ${maxImages} images.`);
          event.target.value = null;
          return;
      }
      Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) {
          this.showGenericMessagePopup("Please upload valid image files (e.g., JPG, PNG, GIF).");
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
            this.showGenericMessagePopup(`File ${file.name} is too large (max 5MB).`);
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          this.lostItemForm.images.push({
            file: file,
            preview: e.target.result
          });
        };
        reader.onerror = (error) => {
            console.error("FileReader error:", error);
            this.showGenericMessagePopup(`Error reading file ${file.name}.`);
        };
        reader.readAsDataURL(file);
      });
      event.target.value = null;
    },
    handleFoundImageUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        const maxImages = 5;
         if (this.foundItemForm.images.length + files.length > maxImages) {
          this.showGenericMessagePopup(`You can upload a maximum of ${maxImages} images.`);
          event.target.value = null;
          return;
        }
        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) {
            this.showGenericMessagePopup("Please upload valid image files (e.g., JPG, PNG, GIF).");
            return;
            }
            if (file.size > 5 * 1024 * 1024) {
                this.showGenericMessagePopup(`File ${file.name} is too large (max 5MB).`);
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
            this.foundItemForm.images.push({
                file: file,
                preview: e.target.result
            });
            };
            reader.onerror = (error) => {
                console.error("FileReader error:", error);
                this.showGenericMessagePopup(`Error reading file ${file.name}.`);
            };
            reader.readAsDataURL(file);
        });
         event.target.value = null;
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
        if (!this.lostItemForm.name || !this.lostItemForm.category || !this.lostItemForm.dateLost || !this.lostItemForm.location || !this.lostItemForm.description) {
            throw new Error("Please fill in all required fields.");
        }
        const searchTerms = this.generateSearchTerms(
          `${this.lostItemForm.name} ${this.lostItemForm.category} ${this.lostItemForm.location} ${this.lostItemForm.description}`
        );
        const dateLostObject = new Date(this.lostItemForm.dateLost);
        if (isNaN(dateLostObject.getTime())) {
            throw new Error("Invalid date selected for 'Date Lost'.");
        }
        const itemData = {
          name: this.lostItemForm.name.trim(),
          category: this.lostItemForm.category,
          dateLost: firebase.firestore.Timestamp.fromDate(dateLostObject),
          location: this.lostItemForm.location,
          description: this.lostItemForm.description.trim(),
          userId: this.user.uid,
          userName: this.userProfile.displayName || this.user.email,
          status: 'active',
          searchTerms: searchTerms,
          image: null,
          hasImages: this.lostItemForm.images.length > 0,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        let docRef;
        const isEditing = !!this.lostItemForm.id;
        if (isEditing) {
          docRef = db.collection('lostItems').doc(this.lostItemForm.id);
          await docRef.update(itemData);
        } else {
          itemData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
          docRef = await db.collection('lostItems').add(itemData);
        }
        if (this.lostItemForm.images.length > 0) {
           const mainImageUrl = await this.uploadImages(docRef.id, this.lostItemForm.images, 'lost');
           if (mainImageUrl) {
               await docRef.update({ image: mainImageUrl });
           }
        }
        await this.loadLostItems();
        this.closeReportLostPopup();
        this.showGenericMessagePopup(isEditing ? "Lost item updated successfully!" : "Lost item reported successfully! We'll notify you if we find a match.");
      } catch (error) {
        console.error("Error reporting lost item:", error);
        this.showGenericMessagePopup(`Error reporting lost item: ${error.message}. Please try again.`);
      } finally {
        this.isSubmitting = false;
      }
    },
    async submitFoundItemReport() {
      if (!this.user) return;
      this.isSubmitting = true;
      try {
         if (!this.foundItemForm.name || !this.foundItemForm.category || !this.foundItemForm.dateFound || !this.foundItemForm.location || !this.foundItemForm.description) {
            throw new Error("Please fill in all required fields.");
        }
        const searchTerms = this.generateSearchTerms(
           `${this.foundItemForm.name} ${this.foundItemForm.category} ${this.foundItemForm.location} ${this.foundItemForm.description}`
        );
        const dateFoundObject = new Date(this.foundItemForm.dateFound);
         if (isNaN(dateFoundObject.getTime())) {
            throw new Error("Invalid date selected for 'Date Found'.");
        }
        const itemData = {
          name: this.foundItemForm.name.trim(),
          category: this.foundItemForm.category,
          dateFound: firebase.firestore.Timestamp.fromDate(dateFoundObject),
          location: this.foundItemForm.location,
          description: this.foundItemForm.description.trim(),
          reportedBy: this.user.uid,
          reportedByName: this.userProfile.displayName || this.user.email,
          status: 'available',
          claimed: false,
          searchTerms: searchTerms,
          image: null,
          hasImages: this.foundItemForm.images.length > 0,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        let docRef;
        const isEditing = !!this.foundItemForm.id;
        if (isEditing) {
          docRef = db.collection('items').doc(this.foundItemForm.id);
          await docRef.update(itemData);
        } else {
          itemData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
          docRef = await db.collection('items').add(itemData);
        }
        if (this.foundItemForm.images.length > 0) {
          const mainImageUrl = await this.uploadImages(docRef.id, this.foundItemForm.images, 'found');
           if (mainImageUrl) {
               await docRef.update({ image: mainImageUrl });
           }
        }
        await this.loadFoundItems();
        this.closeReportFoundPopup();
        this.showGenericMessagePopup(isEditing ? "Found item updated successfully!" : "Found item reported successfully! It will now appear in the search results.");
      } catch (error) {
        console.error("Error reporting found item:", error);
        this.showGenericMessagePopup(`Error reporting found item: ${error.message}. Please try again.`);
      } finally {
        this.isSubmitting = false;
      }
    },
    async uploadImages(itemId, images, type) {
        if (!images || images.length === 0) return null;
        const collection = type === 'lost' ? 'lostItems' : 'items';
        const mainImage = images[0];
        let mainImageUrl = null;
        try {
            const mainImageRef = storage.ref(`${collection}/${itemId}/main_${Date.now()}_${mainImage.file.name}`);
            const uploadTask = await mainImageRef.put(mainImage.file);
            mainImageUrl = await uploadTask.ref.getDownloadURL();
            const additionalImagePromises = [];
            for (let i = 1; i < images.length; i++) {
                const img = images[i];
                const imageRef = storage.ref(`${collection}/${itemId}/img_${i}_${Date.now()}_${img.file.name}`);
                additionalImagePromises.push(
                    imageRef.put(img.file).then(task => task.ref.getDownloadURL())
                );
            }
            await Promise.all(additionalImagePromises);
            return mainImageUrl;
        } catch (error) {
            console.error(`Error uploading images for item ${itemId}:`, error);
            if (error.code === 'storage/unauthorized') {
                this.showGenericMessagePopup("Error: You do not have permission to upload images.");
            } else if (error.code === 'storage/canceled') {
                this.showGenericMessagePopup("Image upload cancelled.");
            } else {
                this.showGenericMessagePopup("An error occurred during image upload. Please try again.");
            }
            throw error;
        }
    },
    generateSearchTerms(text) {
      if (!text) return [];
      const commonWords = new Set(['a', 'an', 'the', 'is', 'in', 'at', 'on', 'of', 'to', 'for', 'and', 'or', 'i', 'me', 'my', 'it', 'its']);
      const terms = text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(term => term.length > 1 && !commonWords.has(term));
      return [...new Set(terms)].slice(0, 20);
    },
    getClaimStatusClass(status) {
      return status ? status.toLowerCase() : 'unknown';
    },
    formatDate(dateValue) {
      try {
        let date;
        if (!dateValue) return "N/A";
        if (typeof dateValue === 'object' && dateValue.toDate) {
          date = dateValue.toDate();
        }
        else if (typeof dateValue === 'string' || typeof dateValue === 'number') {
          date = new Date(dateValue);
        }
        else if (dateValue instanceof Date) {
            date = dateValue;
        }
        else {
          return "Invalid Date";
        }
        if (isNaN(date.getTime())) {
            return "Invalid Date";
        }
        return new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }).format(date);
      } catch (error) {
        console.error("Error formatting date:", dateValue, error);
        return "Date Error";
      }
    },
    truncateDescription(text, maxLength = 100) {
      if (!text) return '';
      if (text.length <= maxLength) return text;
      let truncated = text.substring(0, maxLength);
      let lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > maxLength / 2) {
          truncated = truncated.substring(0, lastSpace);
      }
      return truncated + '...';
    },
    toggleMobileMenu() {
      this.mobileMenuOpen = !this.mobileMenuOpen;
    },
    submitLoginForm() {
      this.authError = null;
      const email = this.loginForm.email.trim();
      const password = this.loginForm.password;
       if (!email || !password) {
            this.authError = "Please enter both email and password.";
            return;
        }
      if (this.isSigningUp) {
          if (password.length < 6) {
              this.authError = "Password must be at least 6 characters long.";
              return;
          }
          firebase.auth().createUserWithEmailAndPassword(email, password)
          .then((userCredential) => {
              this.initializeUserProfile(userCredential.user);
              this.showLoginModal = false;
              this.loginForm = { email: '', password: '' };
              this.isSigningUp = false;
          })
          .catch(error => {
              this.authError = this.getFriendlyAuthError(error);
          });
      } else {
          firebase.auth().signInWithEmailAndPassword(email, password)
          .then(() => {
              this.showLoginModal = false;
              this.loginForm = { email: '', password: '' };
          })
          .catch(error => {
               this.authError = this.getFriendlyAuthError(error);
          });
      }
    },
    initializeUserProfile(user) {
        if (!user) return;
        const userRef = db.collection('users').doc(user.uid);
        userRef.get().then(doc => {
            if (!doc.exists) {
                userRef.set({
                    displayName: user.displayName || '',
                    email: user.email,
                    phone: '',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    preferences: {
                        emailNotifications: true,
                        matchAlerts: true,
                        statusUpdates: true
                    }
                }).catch(error => console.error("Error initializing user profile:", error));
            }
        });
    },
    getFriendlyAuthError(error) {
        switch (error.code) {
            case 'auth/invalid-email': return 'Please enter a valid email address.';
            case 'auth/user-disabled': return 'This account has been disabled by an administrator.';
            case 'auth/user-not-found': return 'No account found with this email address.';
            case 'auth/wrong-password': return 'Incorrect password. Please try again.';
            case 'auth/email-already-in-use': return 'This email address is already registered. Try logging in.';
            case 'auth/weak-password': return 'Password is too weak. Please use at least 6 characters.';
            case 'auth/too-many-requests': return 'Access temporarily disabled due to too many login attempts. Please reset your password or try again later.';
            case 'auth/requires-recent-login': return 'This action requires you to have recently logged in. Please log out and log back in.';
            case 'auth/operation-not-allowed': return 'Email/password sign-in is not enabled. Contact support.';
            case 'auth/popup-closed-by-user': return 'Sign-in popup closed before completion.';
            case 'auth/account-exists-with-different-credential': return 'An account already exists with this email using a different sign-in method (e.g., Google). Try logging in with that method.';
            default: return `An unexpected error occurred: ${error.message}`;
        }
    },
    sendMagicLink() {
      const email = this.magicLinkEmail.trim();
      if (!email) {
        this.authError = "Please enter your email address";
        return;
      }
      this.magicLinkSending = true;
      this.authError = null;
      this.magicLinkSent = false;
      const currentUrl = `${window.location.origin}${window.location.pathname}`;
      const actionCodeSettings = {
        url: currentUrl,
        handleCodeInApp: true
      };
      firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings)
      .then(() => {
        window.localStorage.setItem('emailForSignIn', email);
        this.magicLinkSent = true;
        this.magicLinkEmail = '';
      })
      .catch(error => {
        this.authError = this.getFriendlyAuthError(error);
      })
      .finally(() => {
        this.magicLinkSending = false;
      });
    },
    sendPasswordReset() {
      const email = this.resetEmail.trim();
      if (!email) {
        this.authError = "Please enter your email address";
        return;
      }
      this.passwordResetSending = true;
      this.authError = null;
      this.passwordResetSent = false;
      firebase.auth().sendPasswordResetEmail(email)
      .then(() => {
        this.passwordResetSent = true;
         this.resetEmail = '';
      })
      .catch(error => {
        this.authError = this.getFriendlyAuthError(error);
      })
      .finally(() => {
        this.passwordResetSending = false;
      });
    },
    signInWithProvider(providerType) {
        let provider;
        if (providerType === 'google') {
            provider = new firebase.auth.GoogleAuthProvider();
        } else if (providerType === 'twitter') {
            provider = new firebase.auth.TwitterAuthProvider();
        } else {
            return;
        }
        this.authError = null;
        firebase.auth().signInWithPopup(provider)
        .then((result) => {
            const isNewUser = result.additionalUserInfo?.isNewUser;
            if (isNewUser) {
                this.initializeUserProfile(result.user);
            }
            this.showLoginModal = false;
        })
        .catch(error => {
             this.authError = this.getFriendlyAuthError(error);
        });
    },
    signInWithGoogle() { this.signInWithProvider('google'); },
    signInWithTwitter() { this.signInWithProvider('twitter'); },
    toggleMagicLinkMode() {
      this.magicLinkMode = !this.magicLinkMode;
      this.authError = null;
      this.magicLinkSent = false;
      this.forgotPassword = false;
      this.showAppleComingSoon = false;
    },
    signOut() {
      firebase.auth().signOut()
      .then(() => {
      })
      .catch(error => {
        console.error("Error signing out:", error);
        this.showGenericMessagePopup("Error signing out. Please try again.");
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
          .then((result) => {
            window.localStorage.removeItem('emailForSignIn');
            if (window.history && window.history.replaceState) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
            const isNewUser = result.additionalUserInfo?.isNewUser;
            if (isNewUser) {
                this.initializeUserProfile(result.user);
            }
          })
          .catch((error) => {
            console.error("Error signing in with email link:", error);
            this.showGenericMessagePopup(`Error signing in: ${this.getFriendlyAuthError(error)}`);
            this.isLoading = false;
          });
        } else {
            this.showGenericMessagePopup("Email is required to complete sign-in.");
        }
      }
    }
  },
  beforeUnmount() {
    Object.values(this.flatpickrInstances).forEach(fp => fp.destroy());
  }
});

app.use(window.VueTelInput);
app.mount('#dashboardApp');