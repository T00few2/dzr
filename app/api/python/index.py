from flask import Flask
app = Flask(__name__)

@app.route('/hello', methods=['GET'])
def hello_world():
    return "Hello, World!"

@app.route('/oh', methods=['GET'])
def oh():
    return "Oh!"

if __name__ == '__main__':
    app.run(port=5328)