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
      viewMode: 'grid',
      searchPerformed: false,
      aiAssisted: false,
      shouldScrollToResults: false,
      
      searchQuery: '',
      selectedItemType: '',
      otherItemType: '',
      selectedLocation: '',
      selectedDate: '',
      searchDateRange: {
        from: '',
        to: ''
      },
      sortOption: 'date-desc',
      
      currentPage: 1,
      itemsPerPage: 12,
      totalPages: 1,
      
      searchResults: [],
      allItems: [],
      selectedItem: null,
      itemValuation: null,
      
      showClaimModal: false,
      showClaimCodeModal: false,
      claimItem: null,
      claimForm: {
        description: '',
        contactInfo: ''
      },
      generatedClaimCode: '',
      isSubmittingClaim: false,
      
      // Custom notification popup
      notificationPopup: {
        show: false,
        message: '',
        type: 'info', // 'info', 'success', 'error', 'warning'
        duration: 4000
      },
      
      locations: [
        'Main Building', 'Cafeteria', 'Library', 'Gymnasium',
        'Lecture Hall', 'Parking Lot', 'Bus Stop', 'Park', 'Other'
      ]
    };
  },
  mounted() {
    console.log("Are you a developer/do you work in tech? I'm a 16 year old student, and open to exploring opportunities! Please reach out if you can: https://www.linkedin.com/in/arnav-ravinder");
    
    // Add notification styles to document
    this.injectNotificationStyles();
    
    firebase.auth().onAuthStateChanged(user => {
      this.user = user;
      
      if (user) {
        this.loadUserProfile();
      } else {
        this.isLoading = false;
      }
    });
    
    if (this.$refs.datePicker) {
      this.initDatePicker();
    }
    
    this.checkMagicLinkSignIn();
  },
  updated() {
    if (this.shouldScrollToResults && !this.isLoading) {
      this.scrollToResults();
      this.shouldScrollToResults = false;
    }
  },
  methods: {
    injectNotificationStyles() {
      // Create and add notification styles to head
      if (!document.getElementById('notification-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'notification-styles';
        styleEl.textContent = `
          .notification-popup {
            position: fixed;
            top: 20px;
            right: 20px;
            max-width: 350px;
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            transition: all 0.3s ease;
            opacity: 0;
            transform: translateY(-20px);
            color: white;
            font-family: 'Work Sans', sans-serif;
          }
          .notification-popup.show {
            opacity: 1;
            transform: translateY(0);
          }
          .notification-popup.info {
            background-color: #2196F3;
          }
          .notification-popup.success {
            background-color: #4CAF50;
          }
          .notification-popup.warning {
            background-color: #FF9800;
          }
          .notification-popup.error {
            background-color: #F44336;
          }
          .notification-content {
            display: flex;
            align-items: center;
          }
          .notification-icon {
            margin-right: 12px;
            font-size: 20px;
          }
          .notification-message {
            flex: 1;
            font-size: 14px;
            line-height: 1.5;
          }
          .notification-close {
            margin-left: 12px;
            cursor: pointer;
            font-size: 18px;
            opacity: 0.7;
          }
          .notification-close:hover {
            opacity: 1;
          }
          @media (max-width: 480px) {
            .notification-popup {
              left: 20px;
              right: 20px;
              max-width: calc(100% - 40px);
            }
          }
        `;
        document.head.appendChild(styleEl);
      }
    },
    
    showNotification(message, type = 'info', duration = 4000) {
      // Hide any existing notification
      this.notificationPopup.show = false;
      
      // Set up new notification
      setTimeout(() => {
        this.notificationPopup.message = message;
        this.notificationPopup.type = type;
        this.notificationPopup.duration = duration;
        this.notificationPopup.show = true;
        
        // Create DOM element if it doesn't exist
        let notificationEl = document.getElementById('notification-popup');
        if (!notificationEl) {
          notificationEl = document.createElement('div');
          notificationEl.id = 'notification-popup';
          notificationEl.className = 'notification-popup';
          document.body.appendChild(notificationEl);
        }
        
        // Get icon based on type
        let icon = '';
        switch (type) {
          case 'success': icon = '<i class="fas fa-check-circle"></i>'; break;
          case 'error': icon = '<i class="fas fa-exclamation-circle"></i>'; break;
          case 'warning': icon = '<i class="fas fa-exclamation-triangle"></i>'; break;
          default: icon = '<i class="fas fa-info-circle"></i>';
        }
        
        // Update notification content
        notificationEl.className = `notification-popup ${type}`;
        notificationEl.innerHTML = `
          <div class="notification-content">
            <div class="notification-icon">${icon}</div>
            <div class="notification-message">${message}</div>
            <div class="notification-close" onclick="document.getElementById('notification-popup').classList.remove('show')">×</div>
          </div>
        `;
        
        // Show notification with animation
        setTimeout(() => notificationEl.classList.add('show'), 10);
        
        // Auto hide after duration
        if (duration > 0) {
          setTimeout(() => {
            notificationEl.classList.remove('show');
            // Reset show flag after animation
            setTimeout(() => { this.notificationPopup.show = false; }, 300);
          }, duration);
        }
      }, 300);
    },
    
    scrollToResults() {
      const resultsSection = document.querySelector('.search-results');
      if (resultsSection) {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },

    loadUserProfile() {
      if (!this.user) return;
      
      db.collection('users').doc(this.user.uid).get()
      .then(doc => {
        if (!doc.exists) {
          db.collection('users').doc(this.user.uid).set({
            displayName: this.user.displayName || '',
            email: this.user.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
        
        this.isLoading = false;
      })
      .catch(error => {
        console.error("Error loading user profile:", error);
        this.isLoading = false;
      });
    },
    
    initDatePicker() {
      setTimeout(() => {
        if (this.$refs.datePicker) {
          flatpickr(this.$refs.datePicker, {
            dateFormat: 'Y-m-d',
            maxDate: 'today',
            onChange: (selectedDates) => {
              if (selectedDates.length > 0) {
                const selectedDate = selectedDates[0];
                
                const fromDate = new Date(selectedDate);
                fromDate.setDate(fromDate.getDate() - 7);
                
                const toDate = new Date(selectedDate);
                toDate.setDate(toDate.getDate() + 7);
                
                this.searchDateRange.from = this.formatDateYMD(fromDate);
                this.searchDateRange.to = this.formatDateYMD(toDate);
                
                this.selectedDate = this.formatDateYMD(selectedDate);
              } else {
                this.searchDateRange.from = '';
                this.searchDateRange.to = '';
                this.selectedDate = '';
              }
            }
          });
        }
      }, 100);
    },
    
    formatDateYMD(date) {
      return date.toISOString().split('T')[0];
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
          this.showNotification('Account created successfully!', 'success');
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
          this.showNotification('Logged in successfully!', 'success');
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
        this.showNotification('Password reset email sent!', 'success');
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
        this.showNotification('Logged in with Google successfully!', 'success');
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
        this.showNotification('Logged in with Twitter successfully!', 'success');
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
            this.showNotification('Magic link sign-in successful!', 'success');
          })
          .catch((error) => {
            this.showNotification('Error signing in: ' + error.message, 'error');
          })
          .finally(() => {
            this.isLoading = false;
          });
        }
      }
    },
    
    toggleMobileMenu() {
      this.mobileMenuOpen = !this.mobileMenuOpen;
    },
    
    performSearch() {
      if (!this.user) {
        this.showLoginModal = true;
        return;
      }
      
      this.isLoading = true;
      this.searchPerformed = true;
      this.currentPage = 1;
      
      const searchParams = {
        query: this.searchQuery,
        itemType: this.selectedItemType === 'Others' ? this.otherItemType : this.selectedItemType,
        location: this.selectedLocation,
        dateRange: this.searchDateRange
      };
      
      this.aiAssisted = this.isComplexSearch(searchParams);
      
      if (this.aiAssisted) {
        this.performAISearch(searchParams);
      } else {
        this.performBasicSearch(searchParams);
      }
      
      this.shouldScrollToResults = true;
    },
    
    isComplexSearch(params) {
      return (params.query && params.query.length > 3) || 
             (params.itemType && params.location) ||
             (params.dateRange.from && params.dateRange.to);
    },
    
    performBasicSearch(params) {
      let query = db.collection('items');
      
      if (params.query) {
        query = query.where('searchTerms', 'array-contains-any', 
          this.generateSearchTerms(params.query));
      }
      
      if (params.itemType) {
        query = query.where('category', '==', params.itemType);
      }
      
      if (params.location) {
        query = query.where('location', '==', params.location);
      }
      
      query.get()
        .then(snapshot => {
          let results = [];
          snapshot.forEach(doc => {
            const item = { id: doc.id, ...doc.data() };
            
            if (this.isInDateRange(item.dateFound, params.dateRange)) {
              results.push(item);
            }
          });
          
          results = this.sortResults(results);
          this.updatePagination(results);
          
          // Show notification with results count
          if (results.length > 0) {
            this.showNotification(`Found ${results.length} items matching your search!`, 'success');
          } else {
            this.showNotification('No items found. Try adjusting your search criteria.', 'info');
          }
        })
        .catch(error => {
          console.error("Error searching items:", error);
          this.showNotification('Error performing search. Please try again.', 'error');
          this.searchResults = [];
          this.totalPages = 0;
        })
        .finally(() => {
          this.isLoading = false;
        });
    },
    
    async performAISearch(params) {
      try {
        const snapshot = await db.collection('items').get();
        
        const allItems = [];
        snapshot.forEach(doc => {
          allItems.push({ id: doc.id, ...doc.data() });
        });
        
        const prompt = this.buildAIPrompt(params, allItems);
        
        try {
          const response = await fetch(`https://${getEnvVar('GEMINI_API_URL')}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt })
          });
          
          if (!response.ok) {
            throw new Error('AI search failed with status: ' + response.status);
          }
          
          const data = await response.json();
          
          let aiResponse = "";
          if (data && data.data && data.data.candidates && data.data.candidates.length > 0) {
            aiResponse = data.data.candidates[0].content?.parts?.[0]?.text || "";
          } else if (data && data.response) {
            aiResponse = data.response;
          } else {
            throw new Error('Invalid API response format');
          }
          
          const itemIds = this.extractItemIds(aiResponse);
          
          let results = allItems.filter(item => itemIds.includes(item.id));
          
          if (results.length === 0) {
            results = this.fallbackSearch(params, allItems);
          }
          
          results = this.sortResults(results);
          this.updatePagination(results);
          
          // Show notification with AI results
          if (results.length > 0) {
            this.showNotification(`AI found ${results.length} items that might match what you're looking for!`, 'success');
          } else {
            this.showNotification('No items found. Try adjusting your search criteria.', 'info');
          }
        } catch (apiError) {
          console.error("API error in AI search:", apiError);
          const results = this.fallbackSearch(params, allItems);
          results = this.sortResults(results);
          this.updatePagination(results);
          this.showNotification('AI search encountered an issue. Showing standard results instead.', 'warning');
        }
      } catch (error) {
        console.error("Error in AI search:", error);
        
        const snapshot = await db.collection('items').get();
        const allItems = [];
        snapshot.forEach(doc => {
          allItems.push({ id: doc.id, ...doc.data() });
        });
        
        const results = this.fallbackSearch(params, allItems);
        results = this.sortResults(results);
        this.updatePagination(results);
        this.showNotification('Error in search. Showing basic results instead.', 'warning');
      } finally {
        this.isLoading = false;
      }
    },
    
    buildAIPrompt(params, items) {
      let prompt = "I need to find lost items based on the following criteria:\n\n";
      
      if (params.query) {
        prompt += `Item description: ${params.query}\n`;
      }
      
      if (params.itemType) {
        prompt += `Item type: ${params.itemType}\n`;
      }
      
      if (params.location) {
        prompt += `Location: ${params.location}\n`;
      }
      
      if (params.dateRange.from && params.dateRange.to) {
        prompt += `Date range: From ${params.dateRange.from} to ${params.dateRange.to}\n`;
      }
      
      prompt += "\n\nHere are the available items in our database:\n\n";
      
      items.forEach(item => {
        prompt += `ID: ${item.id}\nName: ${item.name}\nCategory: ${item.category}\nLocation: ${item.location}\nDate Found: ${item.dateFound}\nDescription: ${item.description}\n\n`;
      });
      
      prompt += "\nBased on the search criteria, return a comma-separated list of the most relevant item IDs, ordered by relevance (most relevant first).";
      
      return prompt;
    },
    
    extractItemIds(aiResponse) {
      try {
        if (!aiResponse) {
          return [];
        }
        
        const cleanedResponse = aiResponse.replace(/[^a-zA-Z0-9,-]/g, '');
        return cleanedResponse.split(',')
          .map(id => id.trim())
          .filter(id => id.length > 0);
      } catch (error) {
        console.error("Error extracting item IDs from AI response:", error);
        return [];
      }
    },
    
    fallbackSearch(params, allItems) {
      return allItems.filter(item => {
        const matchesQuery = !params.query || 
          item.name?.toLowerCase().includes(params.query.toLowerCase()) ||
          item.description?.toLowerCase().includes(params.query.toLowerCase());
        
        const matchesType = !params.itemType || 
          item.category?.toLowerCase() === params.itemType.toLowerCase();
        
        const matchesLocation = !params.location || 
          item.location === params.location;
        
        const matchesDate = this.isInDateRange(item.dateFound, params.dateRange);
        
        return matchesQuery && matchesType && matchesLocation && matchesDate;
      });
    },
    
    isInDateRange(dateValue, dateRange) {
      if (!dateRange.from && !dateRange.to) return true;
      
      let itemDate;
      
      if (dateValue && typeof dateValue === 'object' && dateValue.toDate) {
        itemDate = dateValue.toDate();
      } else if (dateValue) {
        itemDate = new Date(dateValue);
      } else {
        return false;
      }
      
      if (isNaN(itemDate.getTime())) {
        return false;
      }
      
      if (dateRange.from) {
        const fromDate = new Date(dateRange.from);
        if (itemDate < fromDate) return false;
      }
      
      if (dateRange.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        if (itemDate > toDate) return false;
      }
      
      return true;
    },
    
    generateSearchTerms(query) {
      const terms = query.toLowerCase()
        .split(/\s+/)
        .filter(term => term.length > 2)
        .slice(0, 10);
      
      if (terms.length === 0) {
        terms.push(query.toLowerCase());
      }
      
      return terms;
    },
    
    updatePagination(results) {
      this.allItems = results;
      this.totalPages = Math.ceil(results.length / this.itemsPerPage);
      
      const startIndex = (this.currentPage - 1) * this.itemsPerPage;
      this.searchResults = results.slice(startIndex, startIndex + this.itemsPerPage);
    },
    
    sortResults(items = null) {
      const toSort = items || [...this.allItems]; 
      
      switch (this.sortOption) {
        case 'date-desc':
          toSort.sort((a, b) => {
            let dateA = a.dateFound;
            let dateB = b.dateFound;
            
            if (dateA && typeof dateA === 'object' && dateA.toDate) {
              dateA = dateA.toDate();
            } else if (dateA) {
              dateA = new Date(dateA);
            }
            
            if (dateB && typeof dateB === 'object' && dateB.toDate) {
              dateB = dateB.toDate();
            } else if (dateB) {
              dateB = new Date(dateB);
            }
            
            return dateB - dateA;
          });
          break;
        case 'date-asc':
          toSort.sort((a, b) => {
            let dateA = a.dateFound;
            let dateB = b.dateFound;
            
            if (dateA && typeof dateA === 'object' && dateA.toDate) {
              dateA = dateA.toDate();
            } else if (dateA) {
              dateA = new Date(dateA);
            }
            
            if (dateB && typeof dateB === 'object' && dateB.toDate) {
              dateB = dateB.toDate();
            } else if (dateB) {
              dateB = new Date(dateB);
            }
            
            return dateA - dateB;
          });
          break;
        case 'relevance':
          if (!this.aiAssisted && this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            toSort.sort((a, b) => {
              const scoreA = this.calculateRelevanceScore(a, query);
              const scoreB = this.calculateRelevanceScore(b, query);
              return scoreB - scoreA;
            });
          }
          break;
      }
      
      return toSort;
    },
    
    calculateRelevanceScore(item, query) {
      let score = 0;
      
      if (!item || !query) return score;
      
      if (item.name && item.name.toLowerCase().includes(query)) {
        score += 10;
        if (item.name.toLowerCase() === query) {
          score += 5;
        }
      }
      
      if (item.category && item.category.toLowerCase().includes(query)) {
        score += 5;
      }
      
      if (item.description && item.description.toLowerCase().includes(query)) {
        score += 3;
      }
      
      if (item.location && item.location.toLowerCase().includes(query)) {
        score += 3;
      }
      
      let itemDate;
      if (item.dateFound) {
        if (typeof item.dateFound === 'object' && item.dateFound.toDate) {
          itemDate = item.dateFound.toDate();
        } else {
          itemDate = new Date(item.dateFound);
        }
        
        if (!isNaN(itemDate.getTime())) {
          const daysAgo = Math.floor((new Date() - itemDate) / (1000 * 60 * 60 * 24));
          if (daysAgo < 7) {
            score += (7 - daysAgo) / 7 * 2;
          }
        }
      }
      
      return score;
    },
    
    resetFilters() {
      this.searchQuery = '';
      this.selectedItemType = '';
      this.otherItemType = '';
      this.selectedLocation = '';
      this.selectedDate = '';
      this.searchDateRange = {
        from: '',
        to: ''
      };
      
      if (this.$refs.datePicker && this.$refs.datePicker._flatpickr) {
        this.$refs.datePicker._flatpickr.clear();
      }
      
      this.searchResults = [];
      this.searchPerformed = false;
      this.aiAssisted = false;
      this.showNotification('Search filters have been reset', 'info');
    },
    
    prevPage() {
      if (this.currentPage > 1) {
        this.currentPage--;
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        this.searchResults = this.allItems.slice(startIndex, startIndex + this.itemsPerPage);
      }
    },
    
    nextPage() {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        this.searchResults = this.allItems.slice(startIndex, startIndex + this.itemsPerPage);
      }
    },
    
    openItemDetails(item) {
      this.selectedItem = { ...item };
      this.itemValuation = null;
      
      if (!item.claimed && this.user) {
        this.getItemValuation(item);
      }
      
      if (item.hasAdditionalImages) {
        this.loadAdditionalImages(item.id);
      }
    },
    
    loadAdditionalImages(itemId) {
      const imagesRef = storage.ref(`items/${itemId}/images`);
      
      imagesRef.listAll()
        .then(result => {
          const downloadPromises = result.items.map(imageRef => 
            imageRef.getDownloadURL());
          
          return Promise.all(downloadPromises);
        })
        .then(urls => {
          if (urls.length > 0) {
            this.selectedItem.additionalImages = urls;
          }
        })
        .catch(error => {
          console.error("Error loading additional images:", error);
        });
    },
    
    async getItemValuation(item) {
      try {
        const response = await fetch(`https://${getEnvVar('GEMINI_API_URL')}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt: `Please estimate the value of the following item in dollars. Return only the numeric value with dollar sign, e.g. "$25" or "$100-150" for a range. No explanation needed.
            
Item: ${item.name}
Category: ${item.category}
Description: ${item.description}`
          })
        });
        
        if (!response.ok) {
          throw new Error('AI valuation failed');
        }
        
        const data = await response.json();
        
        let aiResponse = "";
        if (data && data.data && data.data.candidates && data.data.candidates.length > 0) {
          aiResponse = data.data.candidates[0].content?.parts?.[0]?.text || "";
        } else if (data && data.response) {
          aiResponse = data.response;
        } else {
          throw new Error('Invalid API response format');
        }
        
        this.itemValuation = aiResponse.trim();
        
        if (!this.itemValuation.includes(')) {
          this.itemValuation = ' + this.itemValuation;
        }
      } catch (error) {
        console.error("Error in AI valuation:", error);
        
        if (item.category === 'Electronics') {
          this.itemValuation = "$50-200";
        } else if (item.category === 'Uniform') {
          this.itemValuation = "$20-40";
        } else {
          this.itemValuation = "$10-30";
        }
      }
    },
    
    initiateClaimItem(item) {
      if (!this.user) {
        this.showLoginModal = true;
        return;
      }
      
      if (item.claimed) {
        this.showNotification("This item has already been claimed.", "warning");
        return;
      }
      
      this.claimItem = item;
      this.claimForm = {
        description: '',
        contactInfo: this.user.phoneNumber || this.user.email || ''
      };
      this.showClaimModal = true;
    },
    
    async submitClaim() {
      if (!this.user) {
        this.showLoginModal = true;
        return;
      }
      
      if (!this.claimItem) {
        this.showNotification("No item selected for claiming.", "error");
        return;
      }
      
      this.isSubmittingClaim = true;
      
      try {
        let estimatedValue = 0;
        if (this.itemValuation) {
          const valueMatch = this.itemValuation.match(/\$(\d+)(?:-\d+)?/);
          if (valueMatch && valueMatch[1]) {
            estimatedValue = parseInt(valueMatch[1], 10);
          }
        }
        
        const isHighValue = estimatedValue >= 75;
        const claimStatus = isHighValue ? 'pending' : 'approved';
        
        if (!isHighValue) {
          this.generatedClaimCode = this.generateClaimCode();
        }
        
        const claimData = {
          itemId: this.claimItem.id,
          userId: this.user.uid,
          userName: this.user.displayName || this.user.email,
          userEmail: this.user.email,
          claimDate: firebase.firestore.FieldValue.serverTimestamp(),
          description: this.claimForm.description,
          contactInfo: this.claimForm.contactInfo,
          status: claimStatus,
          itemName: this.claimItem.name,
          itemCategory: this.claimItem.category,
          itemLocation: this.claimItem.location,
          estimatedValue: estimatedValue,
          claimCode: isHighValue ? null : this.generatedClaimCode
        };
        
        const claimRef = await db.collection('claims').add(claimData);
        
        await db.collection('items').doc(this.claimItem.id).update({
          claimed: true,
          claimId: claimRef.id,
          claimStatus: claimStatus
        });
        
        await db.collection('notifications').add({
          userId: this.user.uid,
          title: isHighValue ? 'Claim Submitted for Review' : 'Item Claimed Successfully',
          message: isHighValue 
            ? `Your claim for ${this.claimItem.name} is pending review. Please use the contact form for follow-up.` 
            : `Your claim for ${this.claimItem.name} has been approved. Use code ${this.generatedClaimCode} to collect your item.`,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          type: 'claim',
          read: false,
          actionable: true,
          itemId: this.claimItem.id,
          claimId: claimRef.id
        });
        
        if (isHighValue) {
          this.showClaimModal = false;
          
          const contactUrl = `index.html#contact?claim=${claimRef.id}&item=${this.claimItem.name}`;
          
          this.showNotification(`This item's estimated value (${estimatedValue}) requires verification. Please use the contact form to complete your claim.`, "warning");
          
          setTimeout(() => {
            window.location.href = contactUrl;
          }, 1500);
        } else {
          // Send confirmation email
          try {
            const dateStr = new Date().toISOString();
            const emailResponse = await fetch('https://api.reunited.co.in/api/send-claim-email', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                email: this.user.email,
                userName: this.user.displayName || this.user.email,
                itemName: this.claimItem.name,
                claimCode: this.generatedClaimCode,
                itemLocation: this.claimItem.location,
                claimDate: dateStr
              })
            });
            
            console.log('Email API response:', emailResponse);
            if (!emailResponse.ok) {
              console.error("Email sending failed:", await emailResponse.text());
            }
          } catch (emailError) {
            console.error("Error sending claim email:", emailError);
          }
          
          this.showClaimModal = false;
          this.showClaimCodeModal = true;
        }
      } catch (error) {
        console.error("Error submitting claim:", error);
        this.showNotification("An error occurred while submitting your claim. Please try again.", "error");
      } finally {
        this.isSubmittingClaim = false;
      }
    },
    
    generateClaimCode() {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    },
    
    goToClaimLog() {
      window.location.href = 'dashboard.html#claims';
    },
    
    reportMatch(itemId) {
      if (!this.user) {
        this.showLoginModal = true;
        return;
      }
      
      window.location.href = 'dashboard.html#lost';
    },
    
    disputeClaim(itemId) {
      window.location.href = 'index.html#contact';
    },
    
    formatDate(dateString) {
      try {
        if (dateString && typeof dateString === 'object' && dateString.toDate) {
          return new Intl.DateTimeFormat('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          }).format(dateString.toDate());
        }
        
        if (dateString) {
          const date = new Date(dateString);
          if (!isNaN(date.getTime())) {
            return new Intl.DateTimeFormat('en-US', { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            }).format(date);
          }
        }
        
        return "No date available";
      } catch (error) {
        console.error("Error formatting date:", error);
        return "Date format error";
      }
    },
    
    formatDateTime(dateString) {
      try {
        if (dateString && typeof dateString === 'object' && dateString.toDate) {
          return new Intl.DateTimeFormat('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric'
          }).format(dateString.toDate());
        }
        
        if (dateString) {
          const date = new Date(dateString);
          if (!isNaN(date.getTime())) {
            return new Intl.DateTimeFormat('en-US', { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric',
              hour: 'numeric',
              minute: 'numeric'
            }).format(date);
          }
        }
        
        return "No date available";
      } catch (error) {
        console.error("Error formatting date and time:", error);
        return "Date format error";
      }
    },
    
    truncateDescription(text, maxLength = 100) {
      if (!text || text.length <= maxLength) return text || '';
      return text.substring(0, maxLength) + '...';
    }
  }
}).mount('#searchApp');