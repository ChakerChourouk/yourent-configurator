/** @odoo-module **/
import { Component, useState, useEffect, onMounted } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";

export class YourRentLoader extends Component {
    static template = 'yourent_configurator.yourent_loader';

    setup() {
        this.rpc = useService("rpc");
        this.notification = useService("notification");

        // Loading messages based on property type and selected features
        this.loadingMessages = {
            1: [ // Messages for "Je gère mes biens propres"
                {
                    title: _t("Setting up your personal rental management..."),
                    description: _t("Preparing your dashboard for property owners."),
                    duration: 3000
                },
                {
                    title: _t("Configuring accounting features..."),
                    description: _t("Setting up income and expense tracking for your properties."),
                    duration: 4000
                },
                {
                    title: _t("Preparing contract management..."),
                    description: _t("Getting your lease templates ready."),
                    duration: 3000
                },
                {
                    title: _t("Finalizing your workspace..."),
                    description: _t("Almost ready! Your rental system is taking shape."),
                    duration: 2000
                }
            ],
            2: [ // Messages for "Je gère les biens d'autres propriétaires"
                {
                    title: _t("Setting up your property management agency..."),
                    description: _t("Preparing your professional dashboard."),
                    duration: 3000
                },
                {
                    title: _t("Installing billing automation..."),
                    description: _t("Setting up automatic invoicing for owners and tenants."),
                    duration: 4000
                },
                {
                    title: _t("Configuring commission tracking..."),
                    description: _t("Preparing your fee management system."),
                    duration: 3000
                },
                {
                    title: _t("Setting up owner portals..."),
                    description: _t("Creating secure access for your property owners."),
                    duration: 4000
                },
                {
                    title: _t("Finalizing your agency setup..."),
                    description: _t("Your professional rental management system is almost ready!"),
                    duration: 2000
                }
            ]
        };

        this.state = useState({
            isVisible: false,
            currentMessage: { title: '', description: '' },
            progress: 0,
            propertyType: null,
            selectedOptions: [],
            currentMessageIndex: 0,
            isInstalling: false
        });

        this.messageInterval = null;
        this.progressInterval = null;
        this.installationTracker = null;

        // Prevent page refresh during loading
        useEffect(
            (isVisible) => {
                if (isVisible) {
                    window.addEventListener("beforeunload", this.preventRefresh);
                } else {
                    window.removeEventListener("beforeunload", this.preventRefresh);
                }
                return () => {
                    window.removeEventListener("beforeunload", this.preventRefresh);
                    this.cleanup();
                };
            },
            () => [this.state.isVisible]
        );

        // Expose component instance to parent via callback when mounted
        onMounted(() => {
            if (this.props.onMounted) {
                this.props.onMounted(this);
            }
        });
    }

    preventRefresh = (event) => {
        if (this.state.isVisible) {
            event.preventDefault();
            event.returnValue = _t("Your rental system is being configured. Please don't leave this page.");
            return event.returnValue;
        }
    };

    show(propertyType, selectedOptions) {
        this.state.isVisible = true;
        this.state.propertyType = propertyType;
        this.state.selectedOptions = selectedOptions;
        this.state.progress = 0;
        this.state.currentMessageIndex = 0;
        this.state.isInstalling = false;

        this.startMessageCycle();
        this.startProgressSimulation();
    }

    hide() {
        this.state.isVisible = false;
        this.cleanup();
    }

    cleanup() {
        if (this.messageInterval) {
            clearInterval(this.messageInterval);
            this.messageInterval = null;
        }
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
        if (this.installationTracker) {
            clearTimeout(this.installationTracker);
            this.installationTracker = null;
        }
    }

    startMessageCycle() {
        const messages = this.loadingMessages[this.state.propertyType] || this.loadingMessages[1];

        if (messages.length === 0) return;

        // Set first message
        this.state.currentMessage = messages[0];

        let messageIndex = 0;
        const cycleMessages = () => {
            if (messageIndex < messages.length - 1) {
                messageIndex++;
                this.state.currentMessage = messages[messageIndex];
                this.state.currentMessageIndex = messageIndex;

                this.messageInterval = setTimeout(cycleMessages, messages[messageIndex].duration);
            }
        };

        this.messageInterval = setTimeout(cycleMessages, messages[0].duration);
    }

    startProgressSimulation() {
        // Simulate realistic progress with varying speeds
        const phases = [
            { duration: 3000, endProgress: 15, speed: 'slow' },    // Initial setup
            { duration: 4000, endProgress: 35, speed: 'medium' },  // Module installation
            { duration: 5000, endProgress: 65, speed: 'fast' },    // Configuration
            { duration: 3000, endProgress: 85, speed: 'medium' },  // Final setup
            { duration: 2000, endProgress: 100, speed: 'slow' }    // Completion
        ];

        let currentPhase = 0;
        let phaseStartTime = Date.now();
        let phaseStartProgress = 0;

        const updateProgress = () => {
            if (currentPhase >= phases.length) return;

            const phase = phases[currentPhase];
            const elapsed = Date.now() - phaseStartTime;
            const phaseProgress = Math.min(elapsed / phase.duration, 1);

            // Apply easing for smoother progress
            const easedProgress = this.easeInOutCubic(phaseProgress);
            const progressDelta = (phase.endProgress - phaseStartProgress) * easedProgress;
            this.state.progress = Math.min(phaseStartProgress + progressDelta, phase.endProgress);

            if (phaseProgress >= 1) {
                // Move to next phase
                currentPhase++;
                phaseStartTime = Date.now();
                phaseStartProgress = phase.endProgress;
            }

            if (this.state.progress < 100) {
                this.progressInterval = setTimeout(updateProgress, 50);
            }
        };

        updateProgress();
    }

    // Easing function for smooth progress animation
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    }

    // Method to track actual module installation (similar to website loader)
    async trackModuleInstallation() {
        if (this.state.isInstalling) return;

        this.state.isInstalling = true;

        try {
            // This would call your backend to track actual installation progress
            const result = await this.rpc('/yourent/configurator/track_progress', {
                selected_options: this.state.selectedOptions
            });

            if (result.completed) {
                this.state.progress = 100;
                setTimeout(() => this.hide(), 1000);
            } else {
                // Continue tracking
                this.installationTracker = setTimeout(() => {
                    this.trackModuleInstallation();
                }, 1000);
            }
        } catch (error) {
            console.error('Error tracking installation:', error);
            // Fallback to simulated progress
        }
    }

    // PUBLIC API: Method to be called from Step3Screen
    async startInstallation(propertyType, selectedOptions) {
        this.show(propertyType, selectedOptions);

        try {
            // Start the actual configuration process
            const configData = {
                step1_data: {
                    company_name: this.env.store.companyName,
                    country_id: this.env.store.countryId,
                    logo_attachment_id: this.env.store.logoAttachmentId,
                    language_id: this.env.store.languageId,
                },
                step2_data: propertyType,
                step3_data: selectedOptions,
            };

            const result = await this.rpc('/yourent/configurator/complete', configData);

            // When complete, show success and redirect
            this.state.currentMessage = {
                title: _t("Setup Complete!"),
                description: _t("Your rental management system is ready to use.")
            };
            this.state.progress = 100;

            setTimeout(() => {
                this.hide();
                window.location.href = result.redirect_url || '/web';
            }, 2000);

        } catch (error) {
            console.error('Configuration failed:', error);
            this.state.currentMessage = {
                title: _t("Setup Error"),
                description: _t("Something went wrong. Please try again.")
            };

            if (this.notification) {
                this.notification.add(
                    _t('Configuration failed. Please try again.'),
                    { title: _t('Setup Error'), type: 'danger' }
                );
            }

            setTimeout(() => this.hide(), 3000);
        }
    }
}