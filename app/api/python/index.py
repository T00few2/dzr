from flask import Flask
app = Flask(__name__)

@app.route('/hello')
def hello_world():
    return "Hello, World!"

@app.route('/oh')
def oh():
    return "Oh!"
