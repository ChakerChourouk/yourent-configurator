{
    'name': 'Your Rent Configurator',
    'version': '1.0',
    'author': 'YouRent Group sa',
    'category': 'Technical/Base',
    'website': 'http://www.yourent.immo',
    'summary': ' Yourent Application Configurator',
    'license': 'OEEL-1',
    'summary': 'Configuration wizard for Your Rent module',
    'depends': ['base', 'web'],
    'data': [
        'views/post_install_action.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'yourent_configurator/static/src/js/*',
        ],
    },
    'auto_install': True,
    'application': True,
}