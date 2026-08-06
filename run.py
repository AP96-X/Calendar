# -*- coding: utf-8 -*-
"""日历视图 - 运行入口"""

from backend.app import app
from backend.database import init_db

if __name__ == '__main__':
    init_db()
    print('=' * 50)
    print('  日历视图 应用已启动!')
    print('  请在浏览器中打开: http://127.0.0.1:5000')
    print('=' * 50)
    app.run(host='0.0.0.0', port=5000, debug=False)
