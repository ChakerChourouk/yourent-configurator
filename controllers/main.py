from odoo import http
from odoo.http import request
import werkzeug
import logging

_logger = logging.getLogger(__name__)


class YourRentConfigurator(http.Controller):

    def _check_and_install_required_modules(self):

        required_modules = ['realty_theme','realty_dashboard','yourent_install']

        for module_name in required_modules:
            try:
                # Update module list to ensure latest modules are available
                request.env['ir.module.module'].sudo().update_list()

                module = request.env['ir.module.module'].sudo().search([
                    ('name', '=', module_name)
                ], limit=1)

                if not module:
                    _logger.error(f"Required module '{module_name}' not found in the system")
                    return False, f"Module '{module_name}' not found", False

                if module.state == 'installed':
                    _logger.info(f"Module '{module_name}' is already installed")
                    continue

                if module.state == 'uninstallable':
                    _logger.error(f"Module '{module_name}' is not installable")
                    return False, f"Module '{module_name}' is not installable", False

                if module.state in ['uninstalled', 'to install']:
                    _logger.info(f"Installing required module: '{module_name}'")

                    # Install the module immediately
                    module.button_immediate_install()

                    # Commit the transaction to ensure installation
                    request.env.cr.commit()

                    _logger.info(f"Successfully installed module: '{module_name}'")

                    # Mark that a reload might be needed
                    return True, f"Module '{module_name}' installed successfully", True

            except Exception as e:
                _logger.error(f"Error installing module '{module_name}': {str(e)}")
                return False, f"Error installing '{module_name}': {str(e)}", False

        return True, "All required modules are ready", False
    @http.route(['/yourent/configurator', '/yourent/configurator/<int:step>'],
                type='http', auth="user", website=False, multilang=False)
    def yourent_configurator(self, step=1, **kwargs):
        """
        Route handler for Your Rent configurator
        Similar to website configurator approach

        """


         # Check if configurator was already completed
        verify_configurator = request.env['ir.config_parameter'].sudo().get_param(
            'yourent_configurator.yourent_configurator_done')
        #if verify_configurator=='True':
            #return request.redirect('/web')

        if not request.env.user.has_group('base.group_user'):
            raise werkzeug.exceptions.NotFound()
            # **NEW: Check and install required modules first**
        install_success, install_message, needs_reload = self._check_and_install_required_modules()

        if not install_success:
            # If installation failed, show error page or redirect with error
            _logger.error(f"Cannot start configurator: {install_message}")
            # You can create an error page or redirect to apps menu
            return request.render('yourent_configurator.installation_error', {
                'error_message': install_message
            })

        if needs_reload:

            _logger.info("Modules were installed, forcing page reload for registry refresh")

            # Set a parameter to prevent infinite reload loop
            reload_param = f'yourent_configurator.post_install_reload_{request.env.user.id}'
            already_reloaded = request.env['ir.config_parameter'].sudo().get_param(reload_param)

            if not already_reloaded:
                # Mark that we've done the reload for this user
                request.env['ir.config_parameter'].sudo().set_param(reload_param, 'true')

                # Force a page reload by redirecting to the same URL
                return request.redirect(f'/yourent/configurator/{step}')
            else:
                # Clear the reload parameter since we've successfully reloaded
                request.env['ir.config_parameter'].sudo().set_param(reload_param, False)
                _logger.info("Post-installation reload completed, proceeding with configurator")


        company = request.env.company
        action_url = '/web#action=yourent_configurator.yourent_configurator_redirect'

        # Validate step parameter (now supports steps 1, 2, and 3)
        if step not in [1, 2, 3]:
            step = 1

        # Add step parameter if not on first step
        if step > 1:
            action_url += '&step=' + str(step)

        return request.redirect(action_url)

    @http.route('/yourent/configurator/skip', type='json', auth='user', methods=['POST'])
    def configurator_skip(self):
        """
        Skip configurator and mark as done
        """
        request.env.user.sudo().write({'action_id': False})
        request.env['res.users'].sudo().search([]).add_user_home_action()

        set_configurator = request.env['ir.config_parameter'].sudo().set_param('yourent_configurator.yourent_configurator_done', True)

        verify_configurator = request.env['ir.config_parameter'].sudo().get_param('yourent_configurator.yourent_configurator_done')
        if verify_configurator == 'True':
            return request.redirect('/web')

        return {'status': 'success'}

    def _set_group_multi_landlord_checked(self):
        """
        Apply the same logic as ResConfigSettings.set_group_multi_landlord_checked
        Add all internal users to the multi-landlord group AND update config settings
        """
        try:
            users = request.env['res.users'].search([])
            multi_landlord_group = request.env.ref('realty_property.group_multi_landlord')

            for user in users:
                if not user.has_group('realty_property.group_multi_landlord') and user.has_group('base.group_user'):
                    multi_landlord_group.sudo().write({'users': [(4, user.id)]})

            _logger.info("Successfully applied multi-landlord group to all internal users")

            # IMPORTANT: Force update the config settings to reflect the change
            # This ensures the checkbox appears checked in the settings interface
            self._force_update_config_settings()

        except Exception as e:
            _logger.error(f"Error setting multi-landlord group: {e}")

    def _force_update_config_settings(self):
        """
        Force update the configuration settings to ensure the UI reflects the changes
        This is crucial for making the checkbox appear checked in the settings interface
        """
        try:
            # Get or create a config settings record
            config_settings = request.env['res.config.settings'].sudo()

            # Create a new settings record with the multi-landlord group enabled
            # This will trigger the implied_group logic and update the UI state
            settings_values = {
                'group_multi_landlord': True,
            }

            # Create and execute the settings
            settings_record = config_settings.create(settings_values)
            settings_record.execute()

            _logger.info("Configuration settings updated to reflect multi-landlord group changes")

        except Exception as e:
            _logger.error(f"Error updating configuration settings: {e}")

    def _install_modules_for_options(self, selected_options):
        """
        Install required modules based on selected step 3 options
        Updated to exclude 'multiple' option from initial installation
        """
        # Define mapping of step 3 options to modules (excluding 'multiple')
        OPTION_MODULE_MAPPING = {
            # Basic Features 'realty_tenancy_crm'
            'property': ['realty_property'],
            'new': ['realty_tenancy_crm'],
            'rental': ['realty_rental'],


            # Financial Management
            'Lease': ['realty_tenancy'],#tenancy
            'indexation': ['realty_tenancy_index'],
            'signin': ['realty_tenancy_signed'],
            'condition': ['realty_tenancy_expertym'],
            'reconciliation': ['realty_tenancy_charge'],#tenacy_charge

            'ocr': ['realty_ocr_invoice'],
            'approval': ['realty_invoice_approval'],
            'synchronisation': ['realty_ponto_community'],



            # Reporting & Analytics
            'maintenance': ['realty_maintenance'],
            'ticket': ['realty_ticket'],
            'supplier': ['realty_supplier_portal'],

            # Property Management Agency (only for option 2)
            'mandate': ['realty_mandate'],
            'landlord': ['realty_landlord_portal'],
            'agency': ['realty_rental_agency'],


        }

        modules_to_install = set()

        # Collect all modules that need to be installed (excluding 'multiple')
        for option_id in selected_options:
            if option_id in OPTION_MODULE_MAPPING:
                modules_to_install.update(OPTION_MODULE_MAPPING[option_id])
                _logger.info(f"Option '{option_id}' requires modules: {OPTION_MODULE_MAPPING[option_id]}")
            elif option_id == 'multiple':
                _logger.info("Option 'multiple' detected - will be handled after module installation")

        if not modules_to_install:
            _logger.info("No modules to install based on selected options")
            return

        _logger.info(f"Installing modules: {list(modules_to_install)}")

        # Install each required module
        for module_name in modules_to_install:
            try:
                # Check if module exists and is not already installed
                module = request.env['ir.module.module'].sudo().search([
                    ('name', '=', module_name),
                    ('state', 'in', ['uninstalled', 'to install'])
                ], limit=1)

                if module:
                    _logger.info(f"Installing module: {module_name}")
                    module.button_immediate_install()
                else:
                    # Module might already be installed or doesn't exist
                    installed_module = request.env['ir.module.module'].sudo().search([
                        ('name', '=', module_name),
                        ('state', '=', 'installed')
                    ], limit=1)
                    if installed_module:
                        _logger.info(f"Module {module_name} is already installed")
                    else:
                        _logger.warning(f"Module {module_name} not found in the system")

            except Exception as e:
                _logger.error(f"Error installing module {module_name}: {e}")

        ettings2 = request.env['res.config.settings'].sudo().create({})
        print('etttingg ',ettings2)

    def _handle_post_installation_logic(self, selected_options):
        """
        Handle logic that should run after all modules are installed
        This includes the 'multiple' option multi-landlord group logic
        """
        _logger.info("Handling post-installation logic")

        # Handle 'multiple' option after all modules are installed
        if 'multiple' in selected_options:
            _logger.info("Applying multi-landlord group logic for 'multiple' option (post-installation)")
            self._set_group_multi_landlord_checked()

        # Add any other post-installation logic here
        # For example: setting up default configurations, creating demo data, etc.

        _logger.info("Post-installation logic completed")



    def _save_configuration_summary(self, config_data):
        """
        Save a summary of the configuration for later reference
        """
        try:
            # Save configuration summary as JSON in system parameters
            import json

            summary = {
                'company_name': config_data.get('company_info', {}).get('company_name'),
                'property_type': config_data.get('property_types'),
                'selected_features': config_data.get('selected_features', []),
                'configuration_date': str(request.env.context.get('tz') or 'UTC'),
                'multi_landlord_enabled': 'multiple' in config_data.get('selected_features', []),
            }

            request.env['ir.config_parameter'].sudo().set_param(
                'yourent.configuration_summary',
                json.dumps(summary)
            )

            _logger.info(f"Configuration summary saved: {summary}")

        except Exception as e:
            _logger.error(f"Error saving configuration summary: {e}")

    @http.route('/yourent/configurator/complete', type='json', auth='user', methods=['POST'])
    def configurator_complete(self, **data):
        """
        Complete configurator setup
        Updated data structure:
        - step1_data: Company information (was step3_data)
        - step2_data: Property types (was step1_data)
        - Features data is commented out
        """
        company = request.env.company

        # Process the configuration data with new structure
        config_data = {
            'company_info': data.get('step1_data'),
            'property_types': data.get('step2_data'),
            'selected_features': data.get('step3_data'),  # Step 3 options
        }

        _logger.info(f"Configuration data received: {config_data}")



        chart_template_account =company.chart_template

        company_info = config_data.get('company_info', {})


        if company_info:
            company_updates = {}
            if 'company_name' in company_info and company_info['company_name']:
                company_updates['name'] = company_info['company_name']
            if 'country_id' in company_info and company_info['country_id']:
                company_updates['country_id'] = company_info['country_id']

            if 'language_codes' in company_info and company_info['language_codes']:
                try:
                    language_codes = company_info['language_codes']
                    if not isinstance(language_codes, list):
                        language_codes = [language_codes] if language_codes else []

                    activated_languages = []

                    for lang_code in language_codes:
                        try:
                            existing_lang = request.env['res.lang'].with_context(active_test=False).search(
                                [('code', '=', lang_code)], limit=1
                            )

                            if existing_lang:
                                # Language exists, just activate it
                                if not existing_lang.active:
                                    existing_lang.active = True
                                    _logger.info(f"Activated existing language: {existing_lang.name} ({lang_code})")
                                activated_languages.append(existing_lang)

                            else:
                                _logger.warning(f"Language with code '{lang_code}' not found in system")

                        except Exception as e:
                            _logger.error(f"Error while processing language code {lang_code}: {e}")

                    _logger.info(f"Activated languages: {[lang.name for lang in activated_languages]}")

                except Exception as e:
                    _logger.error(f"Error handling multiple languages: {e}")

            if 'logo_attachment_id' in company_info and company_info['logo_attachment_id']:
                try:
                    attachment = request.env['ir.attachment'].sudo().browse(company_info['logo_attachment_id'])
                    if attachment.exists():
                        logo_base64 = attachment.datas
                        company_updates['logo'] = logo_base64
                        attachment.unlink()
                except Exception as e:
                    _logger.error(f"Error processing logo attachment: {e}")

            if 'brand_color' in company_info or 'secondary_color' in company_info:
                try:
                    vals = {}
                    if company_info.get('brand_color'):
                        vals['color_brand_light'] = company_info['brand_color']
                    if company_info.get('secondary_color'):
                        vals['theme_color_secondary'] = company_info['secondary_color']

                    if vals:
                        settings = request.env['res.config.settings'].sudo().create(vals)
                        settings.execute()
                        _logger.info(f"Theme colors updated: {vals}")

                except Exception as e:
                    _logger.error(f"Error updating theme colors: {e}")
            request.env.cr.commit();
            if company_updates:

                company.sudo().write(company_updates)
                _logger.info(f"Company updated with: {list(company_updates.keys())}")

        # Save property types configuration
        if config_data.get('property_types'):
            request.env['ir.config_parameter'].sudo().set_param(
                'yourent.selected_property_type',
                str(config_data['property_types'])
            )

        # Save step 3 options and install required modules
        selected_options = config_data.get('selected_features', [])
        if selected_options:
            # Save selected options
            request.env['ir.config_parameter'].sudo().set_param(
                'yourent.selected_features',
                ','.join(selected_options)
            )

            _logger.info(f"Selected features to install: {selected_options}")

            # First: Install all required modules (excluding 'multiple' logic)
            self._install_modules_for_options(selected_options)

            # Second: Handle post-installation logic (including 'multiple' option)
            self._handle_post_installation_logic(selected_options)

        # Save configuration summary for reference
        self._save_configuration_summary(config_data)

        request.env.user.sudo().write({'action_id': False})
        request.env['res.users'].sudo().search([]).add_user_home_action()

        set_configurator = request.env['ir.config_parameter'].sudo().set_param('yourent_configurator.yourent_configurator_done', True)

        _logger.info("Configurator completed successfully")

        return {
            'status': 'success',
            'redirect_url': '/web',
            'message': f'Configuration completed with {len(selected_options)} features selected'
        }