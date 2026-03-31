/** @odoo-module **/
import { browser } from "@web/core/browser/browser";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { getDataURLFromFile } from "@web/core/utils/urls";
import { _t } from "@web/core/l10n/translation";
import {YourRentLoader} from "./loader";
import {
    Component,
    onMounted,
    reactive,
    useEnv,
    useState,
    useSubEnv,
    onWillStart,
    useExternalListener,
    useRef,
} from "@odoo/owl";

const ROUTES = {
    welcome: 0,
    step1: 1,  // Company Info with logo and country
    step2: 2,  // Property Types
    step3: 3,
};

// UPDATED: Seulement 2 options comme demandé
const PROPERTY_TYPES = [
    {
        id: 1,
        name: 'I manage my own properties',
        icon: 'fa-home',
        description: 'Gestion de vos propres propriétés en location'
    },
    {
        id: 2,
        name: 'I manage properties for other owners',
        icon: 'fa-building',
        description: 'Gestion immobilière pour le compte de propriétaires tiers'
    },
];

const STEP3_OPTIONS = {
    // Common categories that appear for both property types
    common: [
        {
            id: 'basic_features',
            name: 'Property',
            icon: 'fa-building',

            options: [
                { id: 'property', name: 'Property Management (office)', description: 'Centralized property management with multi-landlord support', required: true },
                { id: 'new', name: 'Visit Management (CRM)',description: 'Capture prospects and manage visit requests',  required: false },
                { id: 'rental', name: 'Rental Listing', description: 'Create and publish rental ads across channels', required: false },
                { id: 'multiple', name: 'Manage multiple landlords',  description: 'Handle properties with separate accounting', required: false },
            ]
        },
        {
            id: 'financial_features',
            name: 'Rental',
            icon: 'fa-home',

            options: [

                { id: 'Lease', name: 'Tenancy Management (office)', description: 'Manage full tenancy lifecycle from move-in to termination', required: false },
                { id: 'indexation', name: 'Indexation', description: 'Automatic rent updates based on legal formulas and indexes', required: false },
                { id: 'signin', name: 'Electronic Lease Signing', description: 'Customize expertise workflow for specific client processes', required: false },
                { id: 'condition', name: 'Property Condition Report Management', description: 'Manage your property portfolio with advanced tools', required: false },
                { id: 'reconciliation', name: 'Charge Reconciliation', description: 'Calculate and recover shared costs from tenants accurately', required: true },
            ]
        },
                {
            id: 'billing_features',
            name: 'Billing',
            icon: 'fa-calculator',

            options: [
                { id: 'ocr', name: 'OCR Invoice Extract', description: 'Automatically extract data from scanned invoices using AI', required: false },
                { id: 'approval', name: 'Invoices payment approval management', description: 'Multi-level approval workflows with visual status tracking', required: false },
                { id: 'synchronisation', name: 'Ponto Banking Synchronization',description: 'Connect with Ponto banking service for automatic transactions', required: false },
            ]
        },
        {
            id: 'reporting_features',
            name: 'Technical',
            icon: 'fa-cogs',

            options: [

                { id: 'maintenance', name: 'Maintenance',description: 'Preventive maintenance scheduling with inventory tracking', required: true },
                { id: 'ticket', name: 'Helpdesk',description: 'Property-focused ticket system with tenant portal access', required: true },
                { id: 'supplier', name: 'Supplier Portal',description: 'Self-service portal for suppliers to manage work orders', required: false },
            ]
        }
    ],
    // Additional category only for property type 2 (managing others' properties)
    2: [
        {
            id: 'agency_features',
            name: 'Agency',
            icon: 'fa-briefcase',

            options: [
                { id: 'mandate', name: 'Mandate',description: 'Manage landlord agreements with automated fee invoicing', required: false},
                { id: 'landlord', name: 'Landlord Portal',description: 'Dedicated portal for landlords to view properties and finances',  required: false },
                { id: 'agency', name: 'Rental Agency',description: 'Complete agency operations with property showcasing and reports',  required: false },

            ]
        }
    ]
};

//------------------------------------------------------------------------------
// Components
//------------------------------------------------------------------------------
class SkipButton extends Component {
    static template = 'yourent_configurator.yourent_configurator_skip_button';

    setup() {
        this.action = useService("action");
        this.rpc = useService("rpc");
    }

    async skipConfigurator() {
        try {
            await this.rpc('/yourent/configurator/skip', {});
            this.action.doAction({
                type: 'ir.actions.act_url',
                url: '/web',
                target: 'self',
            });
        } catch (error) {
            console.error('Skip configurator error:', error);
            window.location.replace('/web');
        }
    }
}

class WelcomeScreen extends Component {
    static template = 'yourent_configurator.yourent_configurator_welcome_screen';
    static components = { SkipButton };

    setup() {
        this.state = useStore();


    }
    goToStep1() {
        this.props.navigate(ROUTES.step1);
    }

    goToStep3() {
        if (this.state.hasSelectedPropertyType()) {
            this.props.navigate(ROUTES.step3);
        }
    }
}

// Step 1: Company Information WITH LOGO UPLOAD AND COUNTRY
class Step1Screen extends Component {
    static template = 'yourent_configurator.yourent_configurator_step1_screen';
    static components = { SkipButton };

    setup() {
        this.state = useStore();
        this.rpc = useService("rpc");
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");

        // NEW: Logo input reference
        this.logoInputRef = useRef('logoSelectionInput');
        this.countryDropdownRef = useRef('countryDropdown');
        this.languageDropdownRef = useRef('languageDropdown');

        // Load countries and languages on component setup
        onWillStart(async () => {
            await Promise.all([
                this.loadCountries(),
                this.loadLanguages(),
                this.loadCurrentBrandColor() // Add this

            ]);
        });


    }
    async loadCurrentBrandColor() {
    try {
        // Get the actual CSS custom properties from the document
        const computedStyles = getComputedStyle(document.documentElement);

        // Get primary color from Odoo's CSS variables
        let currentPrimaryColor = computedStyles.getPropertyValue('--primary-color').trim() ||
                                 computedStyles.getPropertyValue('--o-color-1').trim() ||
                                 computedStyles.getPropertyValue('--bs-primary').trim();

        // Get secondary color from Odoo's CSS variables
        let currentSecondaryColor = computedStyles.getPropertyValue('--secondary-color').trim() ||
                                   computedStyles.getPropertyValue('--o-color-2').trim() ||
                                   computedStyles.getPropertyValue('--bs-secondary').trim();

        // Clean up the colors (remove spaces, convert rgb to hex if needed)
        currentPrimaryColor = this.normalizeColor(currentPrimaryColor) || '#63a3ce';
        currentSecondaryColor = this.normalizeColor(currentSecondaryColor) || '#6c757d';

        this.state.setBrandColor('#63a3ce');
        this.state.setSecondaryColor(currentSecondaryColor);



    } catch (error) {
        console.error('Error loading brand colors:', error);
        // Set default colors if loading fails
        this.state.setBrandColor('#63a3ce');
        this.state.setSecondaryColor('#6c757d');
    }
}

// Add this helper method to normalize colors:
normalizeColor(colorValue) {
    if (!colorValue) return null;

    // Remove spaces and make lowercase
    colorValue = colorValue.trim().toLowerCase();

    // If it's already a hex color, return it
    if (colorValue.startsWith('#')) {
        return colorValue;
    }

    // If it's rgb/rgba, convert to hex
    if (colorValue.startsWith('rgb')) {
        return this.rgbToHex(colorValue);
    }

    // If it's a named color or other format, try to convert it
    return colorValue;
}

// Helper method to convert RGB to hex
rgbToHex(rgb) {
    try {
        // Extract numbers from rgb(r, g, b) or rgba(r, g, b, a)
        const values = rgb.match(/\d+/g);
        if (values && values.length >= 3) {
            const r = parseInt(values[0]);
            const g = parseInt(values[1]);
            const b = parseInt(values[2]);

            return "#" + [r, g, b].map(x => {
                const hex = x.toString(16);
                return hex.length === 1 ? "0" + hex : hex;
            }).join("");
        }
    } catch (error) {
        console.error('Error converting RGB to hex:', error);
    }
    return null;
}

getBrandColor() {
    return this.state.brandColor || '#63a3ce';
}

getSecondaryColor() {
    return this.state.secondaryColor || '#6c757d';
}




        onBrandColorChange(event) {
            const color = event.target.value;
            this.state.setBrandColor(color);
        }
        onSecondaryColorChange(event) {
                const color = event.target.value;
                this.state.setSecondaryColor(color);
            }
        selectLanguageById(languageIds) {
        // Handle both single ID and array of IDs
        const ids = Array.isArray(languageIds) ? languageIds : [languageIds];

        this.state.setLanguageIds(ids);
        const selectedLanguages = this.state.languages.filter(
            language => ids.includes(language.id)
        );
        this.state.setSelectedLanguages(selectedLanguages);
    }

    // Toggle language selection (multi-select)
    toggleLanguage(language, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        const isSelected = this.state.isLanguageSelected(language.id);

        if (isSelected) {
            // Remove language from selection
            this.removeLanguage(language);
        } else {
            // Add language to selection
            this.addLanguage(language);
        }
    }

    // Add a language to selection
    addLanguage(language) {
        const newSelectedLanguages = [...this.state.selectedLanguages, language];
        const newLanguageIds = newSelectedLanguages.map(lang => lang.id);

        this.state.setSelectedLanguages(newSelectedLanguages);
        this.state.setLanguageIds(newLanguageIds);
    }

    // Remove a language from selection
    removeLanguage(language, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        const newSelectedLanguages = this.state.selectedLanguages.filter(
            lang => lang.id !== language.id
        );
        const newLanguageIds = newSelectedLanguages.map(lang => lang.id);

        this.state.setSelectedLanguages(newSelectedLanguages);
        this.state.setLanguageIds(newLanguageIds);
    }

    // Clear all language selections
    clearAllLanguageSelections(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        this.state.setLanguageIds([]);
        this.state.setSelectedLanguages([]);
        this.state.setLanguageSearchText('');
        this.state.setShowLanguageDropdown(false);
    }

    // Handle language search input
    onLanguageSearch(event) {
        const searchText = event.target.value;
        this.state.setLanguageSearchText(searchText);
        this.state.setShowLanguageDropdown(true);
    }

    // Show language dropdown
    showLanguageDropdown(event) {
        this.state.setShowLanguageDropdown(true);
    }

    // Hide language dropdown
    hideLanguageDropdown(event) {
        // Only hide if we're not clicking inside the dropdown
        if (event && event.relatedTarget &&
            event.relatedTarget.closest('.dropdown-menu')) {
            return;
        }
        // Delay hiding to allow for clicks on dropdown items
        setTimeout(() => {
            this.state.setShowLanguageDropdown(false);
        }, 150);
    }






    // Load languages from Odoo
  async loadLanguages() {
    try {
        // const languages = await this.orm.searchRead(
        //     'res.lang',
        //     [], // No domain filter - load ALL languages (active and inactive)
        //     ['id', 'name', 'code', 'iso_code', 'active'], // Include active field to know status
        //     {
        //         order: 'name asc',
        //         context: { active_test: false } // <-- Important
        //
        //     }
        // );
        const languages  = [
            { id: 1, name: 'English (US)', code: 'en_US', active: true },
            { id: 29, name: 'Français (Fr)', code: 'fr_FR', active: true },
            { id: 17, name: 'Dutch (BE) / Nederlands (BE)', code: 'nl_BE', active: true }
        ];

         console.log(languages);
        // Optional: Sort with active languages first, then inactive
        const sortedLanguages = languages.sort((a, b) => {
            // First sort by active status (active first)
            if (a.active !== b.active) {
                return b.active - a.active; // true comes before false
            }
            // Then sort alphabetically by name
            return a.name.localeCompare(b.name);
        });

        this.state.setLanguages(sortedLanguages);
    } catch (error) {
        console.error('Error loading languages:', error);
        this.state.setLanguages([]);
    }
}

// Also add these utility methods to your Step1Screen class:
isLanguageActive(languageId) {
    const language = this.state.languages.find(lang => lang.id === languageId);
    return language?.active || false;
}

getActiveLanguages() {
    return this.state.languages.filter(lang => lang.active) || [];
}

getInactiveLanguages() {
    return this.state.languages.filter(lang => !lang.active) || [];
}
toggleLanguageCheckbox(language, event) {
        const isChecked = event.target.checked;

        if (isChecked) {
            // Add language to selection
            this.addLanguage(language);
        } else {
            // Remove language from selection
            this.removeLanguage(language);
        }
    }

    // Language handling methods
    onLanguageChange(event) {
        const languageId = parseInt(event.target.value);
        this.selectLanguageById(languageId);
    }


    selectLanguage(language, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        this.state.setLanguageId(language.id);
        this.state.setSelectedLanguage(language);
        this.state.setLanguageSearchText('');
        this.state.setShowLanguageDropdown(false);
    }

    clearLanguageSelection(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        this.state.setLanguageId('');
        this.state.setSelectedLanguage(null);
        this.state.setLanguageSearchText('');
        this.state.setShowLanguageDropdown(false);
    }







    // Load countries from Odoo
    async loadCountries() {
        try {
            // Get countries exactly as they appear in res.company form
            const countries = await this.orm.searchRead(
                'res.country',
                [],
                ['id', 'name', 'code', 'currency_id', 'phone_code'],
                {
                    order: 'name asc'
                }
            );

            this.state.setCountries(countries);
        } catch (error) {
            console.error('Error loading countries:', error);
            // If ORM fails, we still need some countries
            this.state.setCountries([]);
        }
    }

    // Country handling methods (existing)
    onCountryChange(event) {
        const countryId = parseInt(event.target.value);
        this.selectCountryById(countryId);
    }

    // Select country by ID
    selectCountryById(countryId) {
        this.state.setCountryId(countryId);

        if (countryId) {
            const selectedCountry = this.state.countries.find(
                country => country.id === countryId
            );
            this.state.setSelectedCountry(selectedCountry);
        } else {
            this.state.setSelectedCountry(null);
        }
    }

    // Select country from dropdown
    selectCountry(country, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        this.state.setCountryId(country.id);
        this.state.setSelectedCountry(country);
        this.state.setCountrySearchText('');
        this.state.setShowCountryDropdown(false);
    }

    // Clear country selection
    clearCountrySelection(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        this.state.setCountryId('');
        this.state.setSelectedCountry(null);
        this.state.setCountrySearchText('');
        this.state.setShowCountryDropdown(false);
    }

    // Handle country search input
    onCountrySearch(event) {
        const searchText = event.target.value;
        this.state.setCountrySearchText(searchText);
        this.state.setShowCountryDropdown(searchText.length > 0 || this.state.countries.length > 0);

        // Clear selection if user is typing and text doesn't match selected country
        if (searchText && this.state.selectedCountry &&
            !this.state.selectedCountry.name.toLowerCase().includes(searchText.toLowerCase())) {
            this.state.setSelectedCountry(null);
            this.state.setCountryId('');
        }
    }

    // Show country dropdown
    showCountryDropdown(event) {
        this.state.setShowCountryDropdown(true);
    }

    // Hide country dropdown (simplified without setTimeout to avoid issues)
    hideCountryDropdown(event) {
        // Only hide if we're not clicking inside the dropdown
        if (event && event.relatedTarget &&
            event.relatedTarget.closest('.dropdown-menu')) {
            return;
        }
        this.state.setShowCountryDropdown(false);
    }

    goToWelcome() {
        this.props.navigate(ROUTES.welcome);
    }

 goToStep2() {
    // Require both company name and country
    if (this.state.companyName && this.state.countryId) {
        this.props.navigate(ROUTES.step2);
    } else {
        // Optional: Show validation message
        if (!this.state.companyName) {
            this.notification.add(
                'Please enter a company name.',
                { type: 'warning' }
            );
        }
        if (!this.state.countryId) {
            this.notification.add(
                'Please select a country.',
                { type: 'warning' }
            );
        }
    }
}

    // Logo upload functionality
    uploadLogo() {
        this.logoInputRef.el.click();
    }

    // Remove logo functionality
    async removeLogo(ev) {
        ev.stopPropagation();
        // Clear the file input
        this.logoInputRef.el.value = "";

        if (this.state.logoAttachmentId) {
            await this._removeAttachments([this.state.logoAttachmentId]);
        }
        this.state.changeLogo(null, null);
    }



    // Change logo handler
    async changeLogo() {
        const logoSelectInput = this.logoInputRef.el;
        if (logoSelectInput.files.length === 1) {
            const previousLogoAttachmentId = this.state.logoAttachmentId;
            const file = logoSelectInput.files[0];

            // Check file size (2.5MB limit)
            if (file.size > 2500000) {
                this.notification.add(
                    _t("The logo is too large. Please upload a logo smaller than 2.5 MB."),
                    {
                        title: file.name,
                        type: "warning",
                    }
                );
                return;
            }

            try {
                const data = await getDataURLFromFile(file);
                const attachment = await this.rpc('/web_editor/attachment/add_data', {
                    'name': 'company_logo',
                    'data': data.split(',')[1],
                    'is_image': true,
                });

                if (!attachment.error) {
                    if (previousLogoAttachmentId) {
                        await this._removeAttachments([previousLogoAttachmentId]);
                    }
                    this.state.changeLogo(data, attachment.id);
                } else {
                    this.notification.add(
                        attachment.error,
                        {
                            title: file.name,
                            type: "danger",
                        }
                    );
                }
            } catch (error) {
                console.error('Logo upload error:', error);
                this.notification.add(
                    _t("Failed to upload logo. Please try again."),
                    {
                        title: file.name,
                        type: "danger",
                    }
                );
            }
        }
    }

    // Remove attachments helper
    async _removeAttachments(ids) {
        try {
            await this.rpc("/web_editor/attachment/remove", { ids: ids });
        } catch (error) {
            console.error('Failed to remove attachment:', error);
        }
    }
}


// Step 2: Property Types
class Step2Screen extends Component {
    static template = 'yourent_configurator.yourent_configurator_step2_screen';
    static components = { SkipButton };

    setup() {
        this.state = useStore();
        this.rpc = useService("rpc");
        this.action = useService("action");
    }


    goToStep1() {
        this.props.navigate(ROUTES.step1);
    }
    goToStep3() {
        if (this.state.hasSelectedPropertyType()) {
            this.state.initializeRequiredOptions();
            this.props.navigate(ROUTES.step3);
        }
    }
}
// Step 3: Options based on step2 selection
// Updated Step3Screen class
class Step3Screen extends Component {
    static template = 'yourent_configurator.yourent_configurator_step3_screen';
    static components = { SkipButton, YourRentLoader };

    setup() {
        this.state = useStore();
        this.rpc = useService("rpc");
        this.action = useService("action");
        this.notification = useService("notification");

        // Create loader reference
        this.loaderComponent = null;

        onMounted(() => {
            this.state.initializeRequiredOptions();
        });
    }
    onLoaderMounted(loaderComponent) {
    this.loaderComponent = loaderComponent;
}

    goToStep2() {
        this.props.navigate(ROUTES.step2);
    }


async completeConfiguration() {
    const languageCodes = this.state.selectedLanguages.map(lang => lang.code);
    const configData = {
        step1_data: {
            company_name: this.state.companyName,
            country_id: this.state.countryId,
            logo_attachment_id: this.state.logoAttachmentId,
            language_codes: languageCodes,
            brand_color: this.state.brandColor,
            secondary_color: this.state.secondaryColor,

        },
        step2_data: this.state.selectedPropertyType,
        step3_data: this.state.selectedStep3Options,
    };

    this.state.isLoading = true;
    this.state.loadingMessage = "Starting setup...";
    this.state.loadingProgress = 0;

    let progressTimer;

    // Gradually increase progress until 90%
    const startProgress = () => {
        progressTimer = setInterval(() => {
            if (this.state.loadingProgress < 90) {
                this.state.loadingProgress += 1;
            }
        }, 100);
    };

    try {
        startProgress();

        const result = await this.rpc('/yourent/configurator/complete', configData);

        clearInterval(progressTimer);

        // Jump to 100% smoothly
        const finishProgress = setInterval(() => {
            if (this.state.loadingProgress < 100) {
                this.state.loadingProgress += 1;
            } else {
                clearInterval(finishProgress);
                this.state.loadingMessage = "Setup complete!";
                setTimeout(() => {
                    this.action.doAction({
                        type: 'ir.actions.act_url',
                        url: result.redirect_url || '/web',
                        target: 'self',
                    });
                }, 800);
            }
        }, 50);
    } catch (error) {
        clearInterval(progressTimer);
        console.error('Configuration failed:', error);

        this.state.loadingMessage = "Error during setup";
        this.state.loadingProgress = 100;

        if (this.notification) {
            this.notification.add(
                'Configuration failed. Please try again.',
                {
                    title: 'Setup Error',
                    type: 'danger',
                }
            );
        }

        setTimeout(() => {
            window.location.replace('/web');
        }, 2000);
    }
}
}

//------------------------------------------------------------------------------
// Store
//------------------------------------------------------------------------------
class Store {
    async start(getInitialState) {
        Object.assign(this, await getInitialState());
    }

    //-------------------------------------------------------------------------
    // Getters
    //-------------------------------------------------------------------------
    getPropertyTypes() {
        return PROPERTY_TYPES;
    }
    getBrandColor()
    {
        return this.brandColor ;
    }

    setSecondaryColor(color) {
    this.secondaryColor = color;
}

        // Get step 3 categories based on selected property type
    getStep3Categories() {
        const categories = [...STEP3_OPTIONS.common]; // Always include common categories

        // Add specific categories based on property type
        if (this.selectedPropertyType === 2 && STEP3_OPTIONS[2]) {
            categories.push(...STEP3_OPTIONS[2]);
        }

        return categories;
    }

    // Get step 3 options based on selected property type
    getStep3Options() {
        const categories = this.getStep3Categories();
        const allOptions = [];

        categories.forEach(category => {
            category.options.forEach(option => {
                // Add category info to option for reference
                allOptions.push({
                    ...option,
                    categoryId: category.id,
                    categoryName: category.name
                });
            });
        });

        return allOptions;
    }
   getSecondaryColor() {
    return this.secondaryColor || '#6c757d';
}

    // UPDATED: Single selection check
    isPropertyTypeSelected(id) {
        return this.selectedPropertyType === id;
    }


    // Check if step 3 option is selected
    isStep3OptionSelected(optionId) {
        return this.selectedStep3Options.includes(optionId);
    }

    // Check if step 3 option is required (cannot be unchecked)
    isStep3OptionRequired(optionId) {
        const allOptions = this.getStep3Options();
        const option = allOptions.find(opt => opt.id === optionId);
        if (!option) return false;

    // Special handling for 'multiple' option based on property type
    if (optionId === 'multiple') {
        // Only required if property type 2 (managing properties for others) is selected
        return this.selectedPropertyType === 2;
    }
        return option && option.required;
    }

    // UPDATED: Check if any property type is selected
    hasSelectedPropertyType() {
        return this.selectedPropertyType !== null;
    }

    // Check if any step 3 options are selected
    hasSelectedStep3Options() {
        return this.selectedStep3Options.length > 0;
    }

    // Get filtered countries based on search text
    getFilteredCountries() {
        if (!this.countrySearchText || this.countrySearchText.length === 0) {
            return this.countries;
        }

        const searchTerm = this.countrySearchText.toLowerCase();
        return this.countries.filter(country =>
            country.name.toLowerCase().includes(searchTerm) ||
            (country.code && country.code.toLowerCase().includes(searchTerm))
        );
    }


setActiveCategory(categoryId) {
    this.activeCategory = categoryId;
}

getActiveCategory() {
    return this.activeCategory || (this.getStep3Categories()[0]?.id || null);
}

// Enhanced category selection methods
isCategorySelected(categoryId) {
    const categories = this.getStep3Categories();
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return false;

    return category.options.some(option => this.isStep3OptionSelected(option.id));
}

getCategorySelectedCount(categoryId) {
    const categories = this.getStep3Categories();
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return 0;

    return category.options.filter(option => this.isStep3OptionSelected(option.id)).length;
}

// Check if all options in a category are selected
isCategoryFullySelected(categoryId) {
    const categories = this.getStep3Categories();
    const category = categories.find(cat => cat.id === categoryId);
    if (!category || category.options.length === 0) return false;

    // Check if all non-required options are selected
    // (Required options should always be selected by default)
    const optionalOptions = category.options.filter(option => !option.required);

    // If there are no optional options, check all options
    const optionsToCheck = optionalOptions.length > 0 ? optionalOptions : category.options;

    return optionsToCheck.every(option => this.isStep3OptionSelected(option.id));
}

// Toggle all options in a category
toggleCategorySelectAll(categoryId, selectAll) {
    const categories = this.getStep3Categories();
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return;

    console.log(`${selectAll ? 'Selecting' : 'Deselecting'} all options in category:`, category.name);

    category.options.forEach(option => {
        // Skip required options - they should always stay selected
        if (option.required) {
            // Ensure required options are selected
            if (!this.selectedStep3Options.includes(option.id)) {
                this.selectedStep3Options.push(option.id);
            }
            return;
        }

        const isCurrentlySelected = this.selectedStep3Options.includes(option.id);

        if (selectAll && !isCurrentlySelected) {
            // Add option to selection
            this.selectedStep3Options.push(option.id);
            console.log('Selected:', option.name);
        } else if (!selectAll && isCurrentlySelected) {
            // Remove option from selection
            const index = this.selectedStep3Options.indexOf(option.id);
            if (index > -1) {
                this.selectedStep3Options.splice(index, 1);
                console.log('Deselected:', option.name);
            }
        }
    });

    // Always ensure required options remain selected after any operation
    this.ensureRequiredOptionsSelected();
}

// Enhanced method to get category selection state for better UI feedback
getCategorySelectionState(categoryId) {
    const categories = this.getStep3Categories();
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return { selected: 0, total: 0, percentage: 0 };

    const selectedCount = category.options.filter(option =>
        this.isStep3OptionSelected(option.id)
    ).length;

    const totalCount = category.options.length;
    const percentage = totalCount > 0 ? Math.round((selectedCount / totalCount) * 100) : 0;

    return {
        selected: selectedCount,
        total: totalCount,
        percentage: percentage,
        isFullySelected: selectedCount === totalCount,
        hasPartialSelection: selectedCount > 0 && selectedCount < totalCount
    };
}

// Method to select all available (non-required) options across all categories
selectAllAvailableOptions() {
    console.log('Selecting all available options');

    const allOptions = this.getStep3Options();
    allOptions.forEach(option => {
        if (!this.selectedStep3Options.includes(option.id)) {
            this.selectedStep3Options.push(option.id);
        }
    });
}

// Method to deselect all optional (non-required) options across all categories
deselectAllOptionalOptions() {
    console.log('Deselecting all optional options');

    const allOptions = this.getStep3Options();
    const requiredOptionIds = allOptions
        .filter(option => option.required)
        .map(option => option.id);

    // Keep only required options
    this.selectedStep3Options = this.selectedStep3Options.filter(optionId =>
        requiredOptionIds.includes(optionId)
    );

    // Ensure required options are still selected
    this.ensureRequiredOptionsSelected();
}

// Enhanced ensure required options method
ensureRequiredOptionsSelected() {
    const allOptions = this.getStep3Options();
    const requiredOptions = allOptions.filter(option => option.required);

    let changeseMade = false;
    requiredOptions.forEach(option => {
        if (!this.selectedStep3Options.includes(option.id)) {
            this.selectedStep3Options.push(option.id);
            changeseMade = true;
            console.log('Auto-selected required option:', option.name);
        }
    });

    if (changeseMade) {
        console.log('Required options ensured');
    }
}

getAutoActiveCategory() {
    const categories = this.getStep3Categories();

    // Find the category with the most recently selected option
    let lastSelectedCategory = null;
    let lastSelectedTime = 0;

    // If we have selection history, use it
    if (this.optionSelectionHistory && this.optionSelectionHistory.length > 0) {
        const lastSelection = this.optionSelectionHistory[this.optionSelectionHistory.length - 1];
        const categoryWithLastOption = categories.find(cat =>
            cat.options.some(opt => opt.id === lastSelection.optionId)
        );
        if (categoryWithLastOption) {
            return categoryWithLastOption.id;
        }
    }

    // Otherwise, find category with most selected options
    let bestCategory = null;
    let maxSelectedCount = 0;

    for (const category of categories) {
        const selectedCount = this.getCategorySelectedCount(category.id);
        if (selectedCount > maxSelectedCount) {
            maxSelectedCount = selectedCount;
            bestCategory = category;
        }
    }

    // If we found a category with selections, use it
    if (bestCategory && maxSelectedCount > 0) {
        return bestCategory.id;
    }

    // Default to first category if no selections
    return categories[0]?.id || null;
}

// Initialize selection history tracking
initializeSelectionHistory() {
    if (!this.optionSelectionHistory) {
        this.optionSelectionHistory = [];
    }
}

// Track when an option is selected/deselected
trackOptionSelection(optionId, isSelected) {
    this.initializeSelectionHistory();

    if (isSelected) {
        // Add to history
        this.optionSelectionHistory.push({
            optionId: optionId,
            timestamp: Date.now(),
            action: 'selected'
        });

        // Keep only last 10 selections to prevent memory bloat
        if (this.optionSelectionHistory.length > 10) {
            this.optionSelectionHistory = this.optionSelectionHistory.slice(-10);
        }

        // Auto-switch to the category containing this option
        const categories = this.getStep3Categories();
        const categoryWithOption = categories.find(cat =>
            cat.options.some(opt => opt.id === optionId)
        );

        if (categoryWithOption) {
            this.setActiveCategory(categoryWithOption.id);
        }
    }
}


    //-------------------------------------------------------------------------
    // Actions
    //-------------------------------------------------------------------------
selectPropertyType(id) {
    const previousPropertyType = this.selectedPropertyType;
    this.selectedPropertyType = id;

    // If property type changed, we need to update required options
    if (previousPropertyType !== id) {
        // Reinitialize required options for the new property type
        this.initializeRequiredOptions();

        // If switching away from property type 2, remove 'multiple' if it was only required
        if (previousPropertyType === 2 && id === 1) {
            // 'multiple' is no longer required, but keep it selected if user wants it
            console.log('Property type changed: "multiple" option is now optional');
        }

        // If switching to property type 2, ensure 'multiple' is selected
        if (id === 2 && !this.selectedStep3Options.includes('multiple')) {
            this.selectedStep3Options.push('multiple');
            console.log('Property type 2 selected: auto-selected "multiple" option');
        }
    }
}

     isCategorySelected(categoryId) {
        const categories = this.getStep3Categories();
        const category = categories.find(cat => cat.id === categoryId);
        if (!category) return false;

        return category.options.some(option => this.isStep3OptionSelected(option.id));
    }
    getCategorySelectedCount(categoryId) {
        const categories = this.getStep3Categories();
        const category = categories.find(cat => cat.id === categoryId);
        if (!category) return 0;

        return category.options.filter(option => this.isStep3OptionSelected(option.id)).length;
    }
    // NEW: Initialize required options based on selected property type
initializeRequiredOptions() {
    if (!this.selectedPropertyType) {
        return;
    }

    const allOptions = this.getStep3Options();

    // Clear existing selections first to handle property type changes
    this.selectedStep3Options = [];

    allOptions.forEach(option => {
        // Use the updated isStep3OptionRequired method which handles conditional logic
        if (this.isStep3OptionRequired(option.id)) {
            if (!this.selectedStep3Options.includes(option.id)) {
                this.selectedStep3Options.push(option.id);
            }
        }
    });
}

toggleStep3Option(optionId) {
    // Check if this option is required (now handles conditional requirements)
    if (this.isStep3OptionRequired(optionId)) {
        // Required options cannot be unchecked, so return early
        console.log(`Option ${optionId} is required and cannot be unchecked`);
        return;
    }

    const index = this.selectedStep3Options.indexOf(optionId);
    if (index > -1) {
        this.selectedStep3Options.splice(index, 1);
    } else {
        this.selectedStep3Options.push(optionId);
    }
}

ensureRequiredOptionsSelected() {
    const allOptions = this.getStep3Options();

    allOptions.forEach(option => {
        // Use the updated isStep3OptionRequired method
        if (this.isStep3OptionRequired(option.id)) {
            if (!this.selectedStep3Options.includes(option.id)) {
                this.selectedStep3Options.push(option.id);
                console.log('Auto-selected required option:', option.name);
            }
        }
    });
}

    // Logo management methods
    changeLogo(data, attachmentId) {
        this.logo = data;
        this.logoAttachmentId = attachmentId;
        console.log(this.logo);
    }

    // Country management methods
    setCountries(countries) {
        this.countries = countries;
    }
    setBrandColor(color) {
            this.brandColor = color;
    }


    setCountryId(countryId) {
        this.countryId = countryId;
    }

    setSelectedCountry(country) {
        this.selectedCountry = country;
    }

    setCountrySearchText(text) {
        this.countrySearchText = text;
    }

    setShowCountryDropdown(show) {
        this.showCountryDropdown = show;
    }
      isLanguageSelected(languageId) {
        return this.selectedLanguages.some(lang => lang.id === languageId);
    }

    // Get filtered languages (excluding already selected ones from dropdown)
    getFilteredLanguages() {
        let filteredLanguages = this.languages;

        // Apply search filter if there's search text
        if (this.languageSearchText && this.languageSearchText.length > 0) {
            const searchTerm = this.languageSearchText.toLowerCase();
            filteredLanguages = filteredLanguages.filter(language =>
                language.name.toLowerCase().includes(searchTerm) ||
                (language.code && language.code.toLowerCase().includes(searchTerm))
            );
        }

        // Sort so selected languages appear first, then unselected
        return filteredLanguages.sort((a, b) => {
            const aSelected = this.isLanguageSelected(a.id);
            const bSelected = this.isLanguageSelected(b.id);

            if (aSelected && !bSelected) return -1;
            if (!aSelected && bSelected) return 1;

            // Within same selection status, sort by active status then name
            if (a.active !== b.active) {
                return b.active - a.active; // active first
            }
            return a.name.localeCompare(b.name);
        });
    }

    // Updated language management methods for multi-select
    setLanguageIds(languageIds) {
        this.languageIds = Array.isArray(languageIds) ? languageIds : [];
    }

    setSelectedLanguages(languages) {
        this.selectedLanguages = Array.isArray(languages) ? languages : [];
    }
setLanguageCodes(codes) {
    this.languageCodes = Array.isArray(codes) ? codes : [];
}
    setLanguages(languages) {
        this.languages = languages;
    }

    setLanguageId(languageId) {
        this.languageId = languageId;
    }

    setSelectedLanguage(language) {
        this.selectedLanguage = language;
    }

    setLanguageSearchText(text) {
        this.languageSearchText = text;
    }

    setShowLanguageDropdown(show) {
        this.showLanguageDropdown = show;
    }

    setCompanyName(name) {
        this.companyName = name;
    }
    setLoading(isLoading) {
    this.isLoading = isLoading;
}

setLoadingMessage(message) {
    this.loadingMessage = message;
}
}

function useStore() {
    const env = useEnv();
    return useState(env.store);
}

//------------------------------------------------------------------------------
// Main Configurator Component
//------------------------------------------------------------------------------
export class YourRentConfigurator extends Component {
    static template = 'yourent_configurator.yourent_configurator_main';
    static components = {
        WelcomeScreen,
        Step1Screen,  // Company Info with logo and country
        Step2Screen,  // Property Types
        Step3Screen,  // Options based on step2 selection
        YourRentLoader,  // Add this

    };

    setup() {
        this.orm = useService('orm');
        this.action = useService('action');
        this.router = useService('router');
        this.rpc = useService("rpc");

        useExternalListener(window, "popstate", () => {
            const match = window.location.pathname.match(/\/yourent\/configurator\/(.*)$/);
            const step = parseInt(match && match[1], 10) || 0;
            this.state.currentStep = step;
        });

        const initialStep = this.props.action.context.params && this.props.action.context.params.step || 0;
        const store = reactive(new Store());

        this.state = useState({
            currentStep: initialStep,
        });

        useSubEnv({ store });

        onWillStart(async () => {
            await store.start(() => this.getInitialState());
        });

        onMounted(() => {
            setTimeout(() => {
                this.router.cancelPushes();
                this.updateBrowserUrl();
            });
        });
    }

    get pathname() {
        return `/yourent/configurator${this.state.currentStep ? `/${this.state.currentStep}` : ''}`;
    }

    updateBrowserUrl() {
        if (typeof history !== 'undefined') {
            history.pushState({}, '', this.pathname);
        }
    }

    navigate(step) {
        this.state.currentStep = step;
        this.updateBrowserUrl();
    }

   async getInitialState() {
    return {
        selectedPropertyType: null,
        activeCategory: null,
        selectedStep3Options: [],
        companyName: '',
        // Country-related state
        countryId: '',
        countries: [],
        selectedCountry: null,
        countrySearchText: '',
        showCountryDropdown: false,
        languageIds: [],
        languages: [],
        selectedLanguages: [], // Changed from selectedLanguage to selectedLanguages (array)
        languageSearchText: '',
        showLanguageDropdown: false,
        // Logo-related state
        logo: null,
        logoAttachmentId: null,
        brandColor: '#63a3ce',
        secondaryColor: '#040404',

        isLoading: false,
        loadingMessage: '',
        loadingProgress: 0,

    };
}

    async skipConfigurator() {
        try {
            await this.rpc('/yourent/configurator/skip', {});
            this.action.doAction({
                type: 'ir.actions.act_url',
                url: '/web',
                target: 'self',
            });
        } catch (error) {
            console.error('Skip configurator error:', error);
            window.location.replace('/web');
        }
    }
}

// registry.category('actions').add('yourent_configurator', YourRentConfigurator);
registry.category('actions').add('yourent_configurator', YourRentConfigurator);