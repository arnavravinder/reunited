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

const AI_API_ENDPOINT = 'https://api.reunited.co.in/api/completions';

const app = Vue.createApp({
  data() {
    return {
      user: null,
      authError: null,
      showLoginModal: false,
      isSigningUp: false,
      loginForm: { email: '', password: '' },
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
      searchDateRange: { from: '', to: '' },
      sortOption: 'relevance',
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
      claimForm: { description: '', contactInfo: '' },
      isSubmittingClaim: false,
      locations: [
        'Main Building', 'Cafeteria', 'Library', 'Gymnasium',
        'Lecture Hall', 'Parking Lot', 'Bus Stop', 'Park', 'Other'
      ]
    };
  },
  mounted() {
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
    scrollToResults() {
      const resultsSection = document.querySelector('.search-results');
      if (resultsSection) {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    loadUserProfile() {
      if (!this.user) return;
      db.collection('users').doc(this.user.uid).get().then(doc => {
        if (!doc.exists) {
          db.collection('users').doc(this.user.uid).set({
            displayName: this.user.displayName || '',
            email: this.user.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
        this.isLoading = false;
      }).catch(error => {
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
      const authPromise = this.isSigningUp
        ? firebase.auth().createUserWithEmailAndPassword(this.loginForm.email, this.loginForm.password)
        : firebase.auth().signInWithEmailAndPassword(this.loginForm.email, this.loginForm.password);
      
      authPromise.then(() => {
        this.showLoginModal = false;
        this.loginForm = { email: '', password: '' };
      }).catch(error => {
        this.authError = error.message;
      });
    },
    sendMagicLink() {
      if (!this.magicLinkEmail) {
        this.authError = "Please enter your email address";
        return;
      }
      this.magicLinkSending = true;
      this.authError = null;
      const actionCodeSettings = { url: window.location.href, handleCodeInApp: true };
      firebase.auth().sendSignInLinkToEmail(this.magicLinkEmail, actionCodeSettings).then(() => {
        window.localStorage.setItem('emailForSignIn', this.magicLinkEmail);
        this.magicLinkSent = true;
      }).catch(error => {
        this.authError = error.message;
      }).finally(() => {
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
      firebase.auth().sendPasswordResetEmail(this.resetEmail).then(() => {
        this.passwordResetSent = true;
      }).catch(error => {
        this.authError = error.message;
      }).finally(() => {
        this.passwordResetSending = false;
      });
    },
    signInWithGoogle() {
      const provider = new firebase.auth.GoogleAuthProvider();
      firebase.auth().signInWithPopup(provider).then(() => {
        this.showLoginModal = false;
      }).catch(error => {
        this.authError = error.message;
      });
    },
    signInWithTwitter() {
      const provider = new firebase.auth.TwitterAuthProvider();
      firebase.auth().signInWithPopup(provider).then(() => {
        this.showLoginModal = false;
      }).catch(error => {
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
          firebase.auth().signInWithEmailLink(email, window.location.href).then(() => {
            window.localStorage.removeItem('emailForSignIn');
            if (window.history && window.history.replaceState) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }).catch(() => {
            alert("Error signing in. Please try again.");
          }).finally(() => {
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
      return params.query && params.query.length > 2;
    },
    async performBasicSearch(params) {
      let query = db.collection('items');
      if (params.itemType) {
        query = query.where('category', '==', params.itemType);
      }
      if (params.location) {
        query = query.where('location', '==', params.location);
      }
      try {
        const snapshot = await query.get();
        let results = [];
        snapshot.forEach(doc => {
          const item = { id: doc.id, ...doc.data() };
          if (this.isInDateRange(item.dateFound, params.dateRange)) {
            results.push(item);
          }
        });

        if (params.query) {
          results = this.fallbackSearch(params, results);
        }

        results = this.sortResults(results);
        this.updatePagination(results);
      } catch (error) {
        console.error("Error searching items:", error);
        this.searchResults = [];
        this.totalPages = 0;
      } finally {
        this.isLoading = false;
      }
    },
    async performAISearch(params) {
      let results = []; // Use 'let' to allow reassignment
      let prefilteredItems = [];
      try {
        prefilteredItems = await this.prefilterItemsForAI(params);
        if (prefilteredItems.length === 0) {
          this.updatePagination([]);
          return;
        }

        const prompt = this.buildAIPrompt(params, prefilteredItems);
        const response = await fetch(AI_API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            model: 'qwen/qwen3-32b',
            temperature: 0.1
          })
        });

        if (!response.ok) {
          throw new Error(`AI search failed with status: ${response.status}`);
        }
        
        const data = await response.json();
        const aiResponse = data?.choices?.[0]?.message?.content || "";
        const itemIds = this.extractItemIds(aiResponse);

        if (itemIds.length > 0) {
          const itemsMap = new Map(prefilteredItems.map(item => [item.id, item]));
          results = itemIds.map(id => itemsMap.get(id)).filter(Boolean);
        } else {
          results = this.fallbackSearch(params, prefilteredItems);
        }
      } catch (error) {
        console.error("Error in AI search, running fallback:", error);
        results = this.fallbackSearch(params, prefilteredItems);
      } finally {
        results = this.sortResults(results);
        this.updatePagination(results);
        this.isLoading = false;
      }
    },
    async prefilterItemsForAI(params) {
      const searchTerms = this.generateSearchTerms(params.query);
      if (searchTerms.length === 0) return [];
      
      let query = db.collection('items');
      if (params.itemType) {
        query = query.where('category', '==', params.itemType);
      }
      query = query.where('searchTerms', 'array-contains-any', searchTerms);

      const snapshot = await query.get();
      const items = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
      return items;
    },
    buildAIPrompt(params, items) {
      let prompt = `From the provided list of items, find all that best match the query: "${params.query}". Analyze name, description, category. Return ONLY a comma-separated list of item IDs, ordered by relevance. Do not include explanation.

---ITEM LIST---
`;
      items.forEach(item => {
        prompt += `ID: ${item.id}, Name: ${item.name}, Description: ${item.description}, Category: ${item.category}\n`;
      });
      return prompt;
    },
    extractItemIds(aiResponse) {
      if (!aiResponse) return [];
      const cleaned = aiResponse.replace(/json/g, '').replace(/```/g, '').trim();
      return cleaned.split(',').map(id => id.trim()).filter(id => id.length > 5);
    },
    fallbackSearch(params, allItems) {
      const query = params.query.toLowerCase();
      return allItems.filter(item => {
        const inName = item.name?.toLowerCase().includes(query);
        const inDesc = item.description?.toLowerCase().includes(query);
        const inType = !params.itemType || item.category?.toLowerCase() === params.itemType.toLowerCase();
        const inLocation = !params.location || item.location === params.location;
        const inDate = this.isInDateRange(item.dateFound, params.dateRange);
        return (inName || inDesc) && inType && inLocation && inDate;
      });
    },
    isInDateRange(dateValue, dateRange) {
      if (!dateRange.from && !dateRange.to) return true;
      if (!dateValue) return false;
      const itemDate = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
      if (isNaN(itemDate.getTime())) return false;
      if (dateRange.from && itemDate < new Date(dateRange.from)) return false;
      if (dateRange.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        if (itemDate > toDate) return false;
      }
      return true;
    },
    generateSearchTerms(query) {
      return [...new Set(query.toLowerCase().split(/\s+/).filter(term => term.length > 2))];
    },
    updatePagination(results) {
        this.allItems = results;
        this.totalPages = Math.ceil(this.allItems.length / this.itemsPerPage);
        this.currentPage = 1;
        this.searchResults = this.allItems.slice(0, this.itemsPerPage);
    },
    sortResults(items = null) {
        const toSort = items || [...this.allItems];
        switch (this.sortOption) {
            case 'date-desc':
                toSort.sort((a, b) => (b.dateFound?.toDate() || 0) - (a.dateFound?.toDate() || 0));
                break;
            case 'date-asc':
                toSort.sort((a, b) => (a.dateFound?.toDate() || 0) - (b.dateFound?.toDate() || 0));
                break;
            case 'relevance':
                if (!this.aiAssisted && this.searchQuery) {
                    const query = this.searchQuery.toLowerCase();
                    toSort.sort((a, b) => this.calculateRelevanceScore(b, query) - this.calculateRelevanceScore(a, query));
                }
                break;
        }
        return toSort;
    },
    calculateRelevanceScore(item, query) {
      let score = 0;
      if (item.name?.toLowerCase().includes(query)) score += 10;
      if (item.category?.toLowerCase().includes(query)) score += 5;
      if (item.description?.toLowerCase().includes(query)) score += 3;
      return score;
    },
    resetFilters() {
      this.searchQuery = '';
      this.selectedItemType = '';
      this.otherItemType = '';
      this.selectedLocation = '';
      this.selectedDate = '';
      this.searchDateRange = { from: '', to: '' };
      if (this.$refs.datePicker?._flatpickr) {
        this.$refs.datePicker._flatpickr.clear();
      }
      this.searchResults = [];
      this.searchPerformed = false;
      this.aiAssisted = false;
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
      imagesRef.listAll().then(result => {
        return Promise.all(result.items.map(ref => ref.getDownloadURL()));
      }).then(urls => {
        if (urls.length > 0) {
          this.selectedItem.additionalImages = urls;
        }
      }).catch(error => console.error("Error loading additional images:", error));
    },
    async getItemValuation(item) {
      try {
        const response = await fetch(AI_API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{
              role: 'user',
              content: `Estimate the value of this item in INR. Return only a numeric value or range with the currency symbol, e.g., "₹2000" or "₹8000-12000". No explanation. Item: ${item.name}, Description: ${item.description}`
            }],
            model: 'qwen/qwen3-32b',
            temperature: 0.3
          })
        });
        if (!response.ok) throw new Error('AI valuation failed');
        const data = await response.json();
        this.itemValuation = data?.choices?.?.message?.content.trim() || "N/A";
      } catch (error) {
        console.error("Error in AI valuation:", error);
        this.itemValuation = "₹500-1500";
      }
    },
    initiateClaimItem(item) {
      if (!this.user) {
        this.showLoginModal = true;
        return;
      }
      if (item.claimed) {
        alert("This item has already been claimed.");
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
      if (!this.user || !this.claimItem) {
        this.showLoginModal = true;
        return;
      }
      this.isSubmittingClaim = true;
      try {
        let estimatedValue = 0;
        if (this.itemValuation) {
          const valueMatch = this.itemValuation.match(/₹(\d+)/);
          if (valueMatch && valueMatch) {
            estimatedValue = parseInt(valueMatch, 10);
          }
        }
        
        const isHighValue = estimatedValue >= 5000;
        const claimStatus = isHighValue ? 'pending' : 'approved';
        
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
          claimCode: this.claimItem.claimCode || null
        };
        
        const claimRef = await db.collection('claims').add(claimData);
        
        await db.collection('items').doc(this.claimItem.id).update({
          claimed: true,
          claimId: claimRef.id,
          claimStatus: claimStatus
        });
        
        const claimantFirstName = this.user.displayName ? this.user.displayName.split(' ') : 'User';
        await db.collection('log').add({
            itemName: this.claimItem.name,
            claimDate: firebase.firestore.FieldValue.serverTimestamp(),
            claimantFirstName: claimantFirstName,
            itemId: this.claimItem.id,
            claimId: claimRef.id
        });
        
        await db.collection('notifications').add({
          userId: this.user.uid,
          title: isHighValue ? 'Claim Submitted for Review' : 'Item Claimed Successfully',
          message: isHighValue 
            ? `Your claim for ${this.claimItem.name} is pending review. Please use the contact form for follow-up.` 
            : `Your claim for ${this.claimItem.name} has been approved. Use code ${this.claimItem.claimCode} to collect your item.`,
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
          alert(`This item's estimated value (₹${estimatedValue}) requires verification. Please use the contact form to complete your claim.`);
          setTimeout(() => { window.location.href = contactUrl; }, 1500);
        } else {
          try {
            await fetch('https://api.reunited.co.in/api/send-claim-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: this.user.email,
                userName: this.user.displayName || this.user.email,
                itemName: this.claimItem.name,
                claimCode: this.claimItem.claimCode,
                itemLocation: this.claimItem.location,
                claimDate: new Date().toISOString()
              })
            });
          } catch (emailError) {
            console.error("Error sending claim email:", emailError);
          }
          this.showClaimModal = false;
          this.showClaimCodeModal = true;
        }
      } catch (error) {
        console.error("Error submitting claim:", error);
        alert("An error occurred while submitting your claim. Please try again.");
      } finally {
        this.isSubmittingClaim = false;
      }
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
        if (dateString && dateString.toDate) {
          return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(dateString.toDate());
        }
        if (dateString) {
          const date = new Date(dateString);
          if (!isNaN(date.getTime())) {
            return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
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
        if (dateString && dateString.toDate) {
          return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' }).format(dateString.toDate());
        }
        if (dateString) {
          const date = new Date(dateString);
          if (!isNaN(date.getTime())) {
            return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' }).format(date);
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